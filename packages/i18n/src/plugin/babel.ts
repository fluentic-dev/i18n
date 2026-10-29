import { compileProgram } from '../compiler';
import { traverse } from '../compiler/analyze';
import { loadOptions, type PluginOptions } from './options';
/** Owns parsing even when a host (e.g. Metro) passes an already parsed AST. */
export default function fluenticBabel(_api: unknown, options: PluginOptions = {}) {
  const config = loadOptions(options);
  const handled = new WeakSet<object>();
  const enabled = (code: string) => config.compiled && code.includes('@fluentic/i18n');

  const compile = (code: string, filename: string) => {
    const { ast } = compileProgram(code, filename, config);
    // Standalone paths have a default Hub. Babel must create its own paths for presets.
    traverse.cache.clear();
    handled.add(ast.program);

    return ast;
  };

  return {
    name: 'fluentic-i18n',
    parserOverride(code: string, parserOptions: { sourceFilename?: string; }) {
      if (!enabled(code)) return undefined;

      return compile(code, parserOptions.sourceFilename ?? 'source.tsx');
    },
    pre(file: any) {
      if (!enabled(file.code) || handled.has(file.path.node)) return;

      const ast = compile(file.code, file.opts.filename ?? 'source.tsx');
      file.path.replaceWith(ast.program);
      file.scope.crawl();
    },
  };
}
