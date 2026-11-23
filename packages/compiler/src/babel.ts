import { traverse } from './analyze';
import { createTransformFilter } from './filter';
import { compileProgram } from './index';
import { loadOptions, type PluginOptions } from './options';
/** Owns parsing even when a host (e.g. Metro) passes an already parsed AST. */
export default function fluenticBabel(_api: unknown, options: PluginOptions = {}) {
  const config = loadOptions(options);
  const filter = createTransformFilter(config);
  const handled = new WeakSet<object>();
  const enabled = (code: string) => code.includes('@fluentic/i18n');

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
      if (!enabled(code) || !filter(parserOptions.sourceFilename ?? 'source.tsx')) return undefined;

      return compile(code, parserOptions.sourceFilename ?? 'source.tsx');
    },
    pre(file: any) {
      if (!enabled(file.code) || !filter(file.opts.filename ?? 'source.tsx') || handled.has(file.path.node)) return;

      const ast = compile(file.code, file.opts.filename ?? 'source.tsx');
      file.path.replaceWith(ast.program);
      file.scope.crawl();
    },
  };
}
