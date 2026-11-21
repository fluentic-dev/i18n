import { transform } from './index';
import { accepts, loadOptions, type PluginOptions } from './options';

export default function fluentic(options: PluginOptions = {}) {
  let config = loadOptions(options);

  return {
    name: 'fluentic-i18n',
    buildStart(this: { addWatchFile(file: string): void; }) {
      if (config.configFile) this.addWatchFile(config.configFile);
    },
    watchChange(id: string) {
      if (id === config.configFile) config = loadOptions(options);
    },
    transform(code: string, id: string) {
      if (!accepts(id, config)) return null;

      return transform(code, { ...config, filename: id.split('?')[0] });
    },
  };
}
