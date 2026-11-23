import { readFile } from 'node:fs/promises';
import { createTransformFilter, DEFAULT_TRANSFORM_INCLUDE } from './filter';
import { transform } from './index';
import { loadOptions, type PluginOptions } from './options';

export default function fluentic(options: PluginOptions = {}) {
  return {
    name: 'fluentic-i18n',
    setup(build: any) {
      let config = loadOptions(options, build.initialOptions.absWorkingDir);
      let filter = createTransformFilter(config);
      build.onStart(() => {
        config = loadOptions(options, build.initialOptions.absWorkingDir);
        filter = createTransformFilter(config);
      });
      build.onLoad(
        { filter: options.config || options.include ? /.*/ : DEFAULT_TRANSFORM_INCLUDE },
        async ({ path }: { path: string; }) => {
          if (!filter(path)) return;

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
        },
      );
    },
  };
}
