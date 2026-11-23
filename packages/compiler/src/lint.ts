import type { NodePath } from '@babel/traverse';
import * as b from '@babel/types';
import { type MessageFormatElement, parse, TYPE } from '@formatjs/icu-messageformat-parser';
import { analyzer, type ExtractedMessage, literal, memberName, parseSource, traverse, unwrap } from './analyze';

export type MessageMatchRule = {
  match: 'exact' | 'contains';
  terms: string | string[];
  caseSensitive?: boolean;
};
export type ParameterSkipRule<Args> =
  | ((args: Args) => boolean)
  | (MessageMatchRule & { check?: never; })
  | { check: (args: Args) => boolean; match?: never; terms?: never; caseSensitive?: never; };
export type ParameterCheck<Args> = boolean | {
  enabled?: boolean;
  skip?: ParameterSkipRule<Args> | ParameterSkipRule<Args>[];
};

/** Shared source-string matching for skip and forbidden-message rules. */
export function matchingMessageTerms(message: string, rule: MessageMatchRule): string[] {
  const normalize = (value: string) => rule.caseSensitive === false ? value.toLowerCase() : value;
  const source = normalize(message);
  const terms = Array.isArray(rule.terms) ? rule.terms : [rule.terms];
  return terms.filter((term) => rule.match === 'exact' ? source === normalize(term) : source.includes(normalize(term)));
}
export type ParameterChecks = boolean | {
  msg?: ParameterCheck<{ message: string; }>;
  jsx?: ParameterCheck<{ message: string; }>;
  text?: ParameterCheck<{ message: string; }>;
  translation?: ParameterCheck<{ message: string; translation: string; }>;
};

/** Skip predicates are synchronous. Invalid results must not silently suppress diagnostics. */
export function shouldCheckParameters<Args extends { message: string; }>(
  check: ParameterCheck<Args> | undefined,
  args: Args,
): boolean {
  if (check === false) return false;
  if (typeof check !== 'object') return true;
  if (check.enabled === false) return false;
  if (!check.skip) return true;
  const rules = Array.isArray(check.skip) ? check.skip : [check.skip];
  for (const rule of rules) {
    const predicate = typeof rule === 'function' ? rule : rule.check;
    if (!predicate) {
      if (matchingMessageTerms(args.message, rule as MessageMatchRule).length) return false;
      continue;
    }
    const skipped: unknown = predicate(args);
    if (typeof skipped !== 'boolean') {
      // Consume rejected promises from accidentally async predicates before reporting the invalid result.
      if (skipped instanceof Promise) void skipped.catch(() => {});
      throw new Error('parameterChecks skip must return a boolean synchronously.');
    }
    if (skipped) return false;
  }
  return true;
}
export type SourceLintOptions = { parameterChecks?: ParameterChecks; };

export type SourceDiagnostic = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  line: number;
  column: number;
};

/** Inspect only statically known message calls; never evaluate application code. */
export function lintSource(
  code: string,
  filename: string,
  imports?: string[],
  options: SourceLintOptions = {},
) {
  const diagnostics: SourceDiagnostic[] = [];
  const messages: ExtractedMessage[] = [];
  const ast = parseSource(code, filename);
  const { resolve } = analyzer(imports);
  traverse(ast, {
    CallExpression(path) {
      const callee = path.get('callee');
      const method = memberName(callee);
      if (!method || !['msg', 'text', 'jsx'].includes(method)) return;
      const diagnostic = (severity: SourceDiagnostic['severity'], code: string, message: string) => {
        diagnostics.push({
          severity,
          code,
          message,
          line: path.node.loc?.start.line ?? 1,
          column: (path.node.loc?.start.column ?? 0) + 1,
        });
      };
      try {
        const scope = resolve((callee as NodePath<b.MemberExpression>).get('object'));
        if (!scope) return;
        const args = path.get('arguments');
        if (!args[0]) {
          diagnostic('error', 'missing-message', `t.${method} requires a message.`);
          return;
        }
        const source = literal(args[0]);
        if (source === null) {
          // Message APIs also accept descriptors (and JSX callbacks), not source strings.
          return;
        }
        messages.push({ ...scope, source, id: scope.context ? `${scope.context}\0${source}` : source });
        const requirements = new Map<string, Set<string>>();
        const walk = (elements: MessageFormatElement[]) => {
          for (const element of elements) {
            if (element.type === TYPE.literal || element.type === TYPE.pound) continue;
            const kind = element.type === TYPE.number || element.type === TYPE.plural
              ? 'number'
              : element.type === TYPE.date || element.type === TYPE.time
              ? 'date'
              : element.type === TYPE.tag
              ? 'tag'
              : 'value';
            const types = requirements.get(element.value) ?? new Set<string>();
            types.add(kind);
            requirements.set(element.value, types);
            if (element.type === TYPE.tag) walk(element.children);
            if (element.type === TYPE.select || element.type === TYPE.plural) {
              for (const option of Object.values(element.options)) walk(option.value);
            }
          }
        };
        try {
          walk(parse(source));
        } catch (error) {
          diagnostic('error', 'invalid-icu', `Invalid source ICU: ${String(error)}`);
          return;
        }
        const checks = options.parameterChecks;
        const check = typeof checks === 'object' ? checks[method as 'msg' | 'jsx' | 'text'] : checks;
        try {
          if (!shouldCheckParameters(check, { message: source })) return;
        } catch (error) {
          diagnostic(
            'error',
            'parameter-check-error',
            `t.${method}: ${error instanceof Error ? error.message : String(error)}`,
          );
          return;
        }
        requirements.delete('break'); // Supplied by the runtime.
        const argument = args[1] ? unwrap(args[1]) : undefined;
        const absent = !argument?.node || argument.isNullLiteral() ||
          (argument.isIdentifier({ name: 'undefined' }) && !argument.scope.getBinding('undefined'));
        if (!absent && !argument?.isObjectExpression()) return;
        const properties = new Map<string, NodePath>();
        let unknownKeys = false;
        if (argument?.isObjectExpression()) {
          for (const property of argument.get('properties')) {
            if (!property.isObjectProperty() && !property.isObjectMethod()) {
              unknownKeys = true;
              continue;
            }
            const key = property.get('key') as NodePath;
            const name = !property.node.computed && key.isIdentifier()
              ? key.node.name
              : key.isStringLiteral()
              ? key.node.value
              : null;
            if (name === null) {
              unknownKeys = true;
              continue;
            }
            properties.set(name, property.isObjectProperty() ? unwrap(property.get('value') as NodePath) : property);
          }
        }
        for (const [name, kinds] of requirements) {
          // Tag handlers cannot be expressed by the primitive descriptor schema.
          if (method === 'msg' && kinds.size === 1 && kinds.has('tag')) continue;
          const value = properties.get(name);
          if (!value) {
            if (!unknownKeys) {
              diagnostic(
                method === 'msg' ? 'warning' : 'error',
                method === 'msg' ? 'missing-schema' : 'missing-param',
                `t.${method} is missing ${method === 'msg' ? 'schema entry' : 'parameter'} ${JSON.stringify(name)}.`,
              );
            }
            continue;
          }
          if (unknownKeys) continue; // A spread or computed property may override this value.
          const primitiveConstructor = value.isIdentifier() && !value.scope.getBinding(value.node.name) &&
              ['String', 'Number', 'Boolean', 'Date'].includes(value.node.name)
            ? value.node.name
            : null;
          const descriptorConstructor = value.isMemberExpression() && memberName(value) === 'msg' &&
            resolve(value.get('object'));
          const constructor = primitiveConstructor ?? (descriptorConstructor ? 't.msg' : null);
          if (method === 'msg') {
            if (
              constructor && ((kinds.has('number') && constructor !== 'Number') ||
                (kinds.has('date') && constructor !== 'Date' && constructor !== 'Number'))
            ) {
              diagnostic('warning', 'schema-type', `Schema for ${JSON.stringify(name)} does not match its ICU type.`);
            } else if (value.isLiteral()) {
              diagnostic(
                'error',
                'invalid-schema',
                `Schema for ${
                  JSON.stringify(name)
                } must use a constructor such as String or Number, or t.msg for a descriptor.`,
              );
            }
          } else if (constructor) {
            diagnostic(
              'error',
              'schema-as-value',
              `Pass a runtime value for ${JSON.stringify(name)}, not ${constructor}.`,
            );
          } else if (value.isIdentifier({ name: 'undefined' }) && !value.scope.getBinding('undefined')) {
            diagnostic('error', 'missing-param', `Parameter ${JSON.stringify(name)} is undefined.`);
          } else if (
            (kinds.has('number') || kinds.has('date')) &&
            (value.isStringLiteral() || value.isBooleanLiteral() || value.isNullLiteral())
          ) {
            diagnostic(
              'error',
              'param-type',
              `Parameter ${JSON.stringify(name)} requires ${kinds.has('number') ? 'a number' : 'a Date or timestamp'}.`,
            );
          }
        }
        for (const name of properties.keys()) {
          if (name !== 'break' && !requirements.has(name)) {
            diagnostic(
              'warning',
              'unused-param',
              `t.${method} provides ${JSON.stringify(name)}, but the message does not use it.`,
            );
          }
        }
      } catch (error) {
        diagnostic('error', 'extraction', error instanceof Error ? error.message : String(error));
      }
    },
  });
  return { messages, diagnostics };
}
