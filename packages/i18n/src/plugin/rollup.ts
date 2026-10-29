import { readFile } from 'node:fs/promises';
import { transform } from '../compiler';
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
    async load(id: string) {
      if (!id.endsWith('.jsonl')) return null;

      const content = await readFile(id, 'utf8');

      return { code: 'export default ' + JSON.stringify(content), map: { mappings: '' } };
    },
    transform(code: string, id: string) {
      if (!config.compiled || !accepts(id, config)) return null;

      return transform(code, { ...config, filename: id.split('?')[0] });
    },
  };
}
