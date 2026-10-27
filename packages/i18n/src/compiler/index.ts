import * as generatorModule from '@babel/generator';
import type { NodePath } from '@babel/traverse';
import * as b from '@babel/types';
import {
  analyzer,
  collectMessages,
  type ExtractedMessage,
  importMap,
  literal,
  memberName,
  parseSource,
  traverse,
} from './analyze';
import { compileMessage, messageId } from './message';
export { collectMessages } from './analyze';
export * from './message';
const generate = ((generatorModule.default as unknown as { default?: typeof generatorModule.default; }).default ??
  generatorModule.default) as typeof generatorModule.default;
export type CompilerOptions = { compiled?: boolean; filename?: string; };
export function compileProgram(code: string, filename: string, options: CompilerOptions = {}) {
  const ast = parseSource(code, filename);
  const messages: ExtractedMessage[] = [];
  if (options.compiled === false) return { ast, messages, changed: false };
  const analysis = analyzer();
  const plans: Array<
    {
      path: NodePath<b.CallExpression>;
      source: string | null;
      scope: NonNullable<ReturnType<typeof analysis.resolve>>;
    }
  > = [];
  const declarations: NodePath<b.ImportDeclaration>[] = [];
  let program: NodePath<b.Program> | undefined;
  traverse(ast, {
    Program(path) {
      program = path;
    },
    ExportAllDeclaration(path) {
      if (importMap[path.node.source.value]) {
        throw new Error('[i18n] do not re-export the translator in compiled mode; import t directly at each use');
      }
    },
    ExportNamedDeclaration(path) {
      if (
        path.node.source && importMap[path.node.source.value] &&
        path.node.specifiers.some((specifier) =>
          b.isExportSpecifier(specifier) && (b.isIdentifier(specifier.local) ? specifier.local.name : '') === 't'
        )
      ) throw new Error('[i18n] do not re-export the translator in compiled mode; export message descriptors instead');
    },
    ImportDeclaration(path) {
      if (importMap[path.node.source.value] && path.node.importKind !== 'type') declarations.push(path);
    },
    CallExpression(path) {
      const callee = path.get('callee');
      const method = memberName(callee);
      if (!method || !['msg', 'jsx', 'text'].includes(method)) return;
      const scope = analysis.resolve((callee as NodePath<b.MemberExpression>).get('object'));
      if (!scope) return;
      const source = literal(path.get('arguments.0') as NodePath);
      if (source === null && method === 'msg') {
        throw new Error(`[i18n] ${filename}:${path.node.loc?.start.line}: t.msg requires a static message`);
      }
      plans.push({ path, source, scope });
      if (source !== null) {
        messages.push({ ...scope, source, id: scope.context ? `${scope.context}\0${source}` : source });
      }
    },
  });
  // Discover unused/escaping scopes as well as scopes reached by message calls.
  traverse(ast, {
    VariableDeclarator(path) {
      analysis.resolve(path.get('id') as NodePath);
    },
    CallExpression(path) {
      const name = memberName(path.get('callee'));
      if (name && ['context', 'note', 'meta'].includes(name)) analysis.resolve(path);
    },
  });
  function expressionUse(path: NodePath): NodePath {
    while (
      path.parentPath &&
      (path.parentPath.isTSAsExpression() || path.parentPath.isTSSatisfiesExpression() ||
        path.parentPath.isTSNonNullExpression() || path.parentPath.isTypeCastExpression() ||
        path.parentPath.isParenthesizedExpression())
    ) path = path.parentPath;
    return path;
  }
  for (const path of analysis.scopeCalls) {
    const use = expressionUse(path);
    const parent = use.parentPath;
    if (parent?.isVariableDeclarator() || parent?.isExpressionStatement()) continue;
    if (parent?.isMemberExpression() && parent.get('object') === use && parent.parentPath?.isCallExpression()) continue;
    throw new Error('[i18n] scoped translator escapes same-file message calls');
  }
  for (const binding of analysis.scopedBindings) {
    if (binding.path.parentPath?.parentPath?.isExportNamedDeclaration()) {
      throw new Error('[i18n] scoped translators cannot be exported; repeat the context in the consuming file');
    }
    for (const reference of binding.referencePaths) {
      if (reference.findParent((parent) => parent.isTSType())) continue;
      const use = expressionUse(reference);
      const parent = use.parentPath;
      if (parent?.isVariableDeclarator() && parent.get('init') === use) continue;
      if (parent?.isMemberExpression() && parent.get('object') === use) {
        const method = memberName(parent);
        if (
          method && ['msg', 'text', 'jsx', 'context', 'note', 'meta'].includes(method) &&
          parent.parentPath?.isCallExpression()
        ) continue;
      }
      throw new Error('[i18n] scoped translator escapes same-file message calls: ' + binding.identifier.name);
    }
  }
  if (!declarations.length) return { ast, messages, changed: false };
  const helper = program!.scope.generateUidIdentifier('tc');
  if (plans.length) {
    program!.unshiftContainer(
      'body',
      b.importDeclaration([b.importSpecifier(helper, b.identifier('t'))], b.stringLiteral('@fluentic/i18n/compiled')),
    );
  }
  for (const { path, source, scope } of plans) {
    const callee = path.get('callee') as NodePath<b.MemberExpression>;
    callee.get('object').replaceWith(b.cloneNode(helper));
    if (source !== null) {
      const replacement = b.valueToNode([messageId(scope.context, source), compileMessage(source)]);
      b.inherits(replacement, path.node.arguments[0]);
      path.node.arguments[0] = replacement;
    }
  }
  // All scope uses were checked before mutation. Remove aliases from leaves to roots.
  let removed = true;
  while (removed) {
    removed = false;
    program!.scope.crawl();
    for (const binding of analysis.scopedBindings) {
      if (binding.path.removed) continue;
      const current = binding.path.scope.getBinding(binding.identifier.name);
      if (current && !current.referenced) {
        binding.path.remove();
        removed = true;
      }
    }
  }
  for (const path of analysis.scopeCalls) {
    if (!path.removed) {
      const use = expressionUse(path);
      if (use.parentPath?.isExpressionStatement()) use.parentPath.remove();
    }
  }
  for (const declaration of declarations) declaration.node.source.value = importMap[declaration.node.source.value];
  program!.scope.crawl();
  for (const declaration of declarations) {
    declaration.node.specifiers = declaration.node.specifiers.filter((specifier) => {
      if (
        !b.isImportSpecifier(specifier) ||
        (b.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value) !== 't'
      ) return true;
      return Boolean(program!.scope.getBinding(specifier.local.name)?.referenced);
    });
    if (!declaration.node.specifiers.length) declaration.remove();
  }
  return { ast, messages, changed: true };
}
export function transform(code: string, options: CompilerOptions = {}) {
  const filename = options.filename ?? 'source.tsx';
  const result = compileProgram(code, filename, options);
  if (!result.changed) return null;
  const output = generate(result.ast, { sourceMaps: true, sourceFileName: filename, comments: true }, code);
  return { code: output.code, map: output.map, messages: result.messages };
}
