import { readFile } from 'node:fs/promises';
import { transform } from '../compiler';
import { accepts, loadOptions, type PluginOptions } from './options';

export default function fluentic(options: PluginOptions = {}) {
  return {
    name: 'fluentic-i18n',
    setup(build: any) {
      let config = loadOptions(options, build.initialOptions.absWorkingDir);
      build.onStart(() => {
        config = loadOptions(options, build.initialOptions.absWorkingDir);
      });
      build.onLoad(
        { filter: /\.jsonl$/ },
        async ({ path }: { path: string; }) => ({
          contents: await readFile(path, 'utf8'),
          loader: 'text',
          watchFiles: [path],
        }),
      );
      build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async ({ path }: { path: string; }) => {
        if (!config.compiled || !accepts(path, config)) return;

        const result = transform(await readFile(path, 'utf8'), { ...config, filename: path });

        if (!result) return;

        const loader = /\.tsx$/.test(path)
          ? 'tsx'
          : /\.[cm]?ts$/.test(path)
          ? 'ts'
          : /\.jsx$/.test(path)
          ? 'jsx'
          : 'js';

        return {
          contents: result.code + '\n//# sourceMappingURL=data:application/json;base64,' +
            Buffer.from(JSON.stringify(result.map)).toString('base64'),
          loader,
          watchFiles: [path, ...(config.configFile ? [config.configFile] : [])],
        };
      });
    },
  };
}
