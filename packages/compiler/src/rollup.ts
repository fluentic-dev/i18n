import { createTransformFilter, normalizeModuleId } from './filter';
import { transform } from './index';
import { loadOptions, type PluginOptions } from './options';

export default function fluentic(options: PluginOptions = {}) {
  let config = loadOptions(options);
  let filter = createTransformFilter(config);

  return {
    name: 'fluentic-i18n',
    buildStart(this: { addWatchFile(file: string): void; }) {
      if (config.configFile) this.addWatchFile(config.configFile);
    },
    watchChange(id: string) {
      if (id === config.configFile) {
        config = loadOptions(options);
        filter = createTransformFilter(config);
      }
    },
    transform(code: string, id: string) {
      if (!filter(id)) return null;

      return transform(code, { ...config, filename: normalizeModuleId(id) });
    },
  };
}
