import { parse } from '@babel/parser';
import * as traverseModule from '@babel/traverse';
import type { Binding, NodePath } from '@babel/traverse';
import * as b from '@babel/types';

const traverse = ((traverseModule.default as unknown as { default?: typeof traverseModule.default; }).default ??
  traverseModule.default) as typeof traverseModule.default;
export { traverse };

export const importMap: Record<string, string> = {
  '@fluentic/i18n': '@fluentic/i18n/compiled',
  '@fluentic/i18n/core': '@fluentic/i18n/compiled',
};
export type Scope = { context: string | null; notes: string[]; meta?: unknown; };
export type ExtractedMessage = Scope & { id: string; source: string; };

export function parseSource(code: string, filename: string) {
  return parse(code, {
    sourceFilename: filename,
    sourceType: 'unambiguous',
    plugins: [
      ...(/\.[cm]?tsx?$/.test(filename) ? ['typescript' as const] : []),
      ...(!/\.[cm]?ts$/.test(filename) ? ['jsx' as const] : []),
      'decorators-legacy',
      'importAttributes',
    ],
  });
}

export function unwrap(path: NodePath): NodePath {
  while (
    path.isTSAsExpression() || path.isTSSatisfiesExpression() || path.isTSNonNullExpression() ||
    path.isTypeCastExpression() || path.isParenthesizedExpression()
  ) path = path.get('expression') as NodePath;

  return path;
}

export function literal(path: NodePath, seen = new Set<Binding>()): string | null {
  path = unwrap(path);
  if (path.isStringLiteral()) return path.node.value;
  if (path.isTemplateLiteral() && !path.node.expressions.length) return path.node.quasis[0].value.cooked ?? '';
  if (path.isIdentifier()) {
    const binding = path.scope.getBinding(path.node.name);

    if (binding?.constant && binding.path.isVariableDeclarator() && !seen.has(binding)) {
      seen.add(binding);

      return literal(binding.path.get('init') as NodePath, seen);
    }
  }

  return null;
}

export function memberName(path: NodePath): string | null {
  if (!path.isMemberExpression()) return null;

  const property = path.get('property');

  return !path.node.computed && property.isIdentifier()
    ? property.node.name
    : property.isStringLiteral()
    ? property.node.value
    : null;
}

export function analyzer(imports = Object.keys(importMap)) {
  const memo = new Map<Binding, Scope | null>();
  const scopedBindings = new Set<Binding>();
  const scopeCalls = new Set<NodePath>();

  const resolve = (path: NodePath, visiting = new Set<Binding>()): Scope | null => {
    path = unwrap(path);
    if (path.isIdentifier()) {
      const binding = path.scope.getBinding(path.node.name);

      if (!binding) return null;
      if (memo.has(binding)) return memo.get(binding)!;
      if (visiting.has(binding)) throw new Error('[i18n] circular translator alias');
      if (binding.path.isImportSpecifier()) {
        const declaration = binding.path.parentPath;
        const imported = binding.path.node.imported;

        return declaration.isImportDeclaration() && imports.includes(declaration.node.source.value) &&
            (b.isIdentifier(imported) ? imported.name : imported.value) === 't' &&
            declaration.node.importKind !== 'type'
          ? { context: null, notes: [] }
          : null;
      }
      if (binding.path.isVariableDeclarator()) {
        visiting.add(binding);
        const scope = resolve(binding.path.get('init') as NodePath, visiting);
        visiting.delete(binding);
        if (scope && !binding.constant) {
          throw new Error('[i18n] translator aliases must not be reassigned: ' + path.node.name);
        }
        memo.set(binding, scope);
        if (scope) scopedBindings.add(binding);

        return scope;
      }

      return null;
    }
    if (path.isMemberExpression() && memberName(path) === 't') {
      const object = path.get('object');

      if (!object.isIdentifier()) return null;

      const binding = object.scope.getBinding(object.node.name);
      const declaration = binding?.path.parentPath;

      if (
        binding?.path.isImportNamespaceSpecifier() && declaration?.isImportDeclaration() &&
        imports.includes(declaration.node.source.value)
      ) return { context: null, notes: [] };
    }
    if (!path.isCallExpression()) return null;

    const callee = path.get('callee');
    const method = memberName(callee);

    if (!method || !['context', 'note', 'meta'].includes(method)) return null;

    const parent = resolve((callee as NodePath<b.MemberExpression>).get('object'), visiting);

    if (!parent) return null;
    if (path.node.arguments.length !== 1) throw new Error('[i18n] scope methods require one static argument');

    const argument = path.get('arguments.0') as NodePath;
    scopeCalls.add(path);
    if (method === 'meta') {
      const evaluated = argument.evaluate();

      if (!evaluated.confident) throw new Error('[i18n] metadata must be statically known');

      return { ...parent, meta: evaluated.value };
    }

    const value = literal(argument);

    if (value === null) throw new Error('[i18n] ' + method + ' must be a static string');

    return method === 'note'
      ? { ...parent, notes: [...parent.notes, value] }
      : { ...parent, context: parent.context ? `${parent.context}.${value}` : value };
  };

  return { resolve, scopedBindings, scopeCalls };
}

export function collectMessages(code: string, filename: string, imports?: string[]): ExtractedMessage[] {
  const ast = parseSource(code, filename);
  const { resolve } = analyzer(imports);
  const messages: ExtractedMessage[] = [];
  traverse(ast, {
    CallExpression(path) {
      const callee = path.get('callee');
      const method = memberName(callee);

      if (!method || !['msg', 'text', 'jsx'].includes(method)) return;

      const scope = resolve((callee as NodePath<b.MemberExpression>).get('object'));

      if (!scope) return;

      const source = literal(path.get('arguments.0') as NodePath);

      if (source === null) {
        if (method === 'msg') {
          throw new Error(`[i18n] ${filename}:${path.node.loc?.start.line}: t.msg requires a static message`);
        }

        return;
      }
      messages.push({ ...scope, id: scope.context ? `${scope.context}\0${source}` : source, source });
    },
  });

  return [...new Map(messages.map((message) => [message.id, message])).values()];
}
