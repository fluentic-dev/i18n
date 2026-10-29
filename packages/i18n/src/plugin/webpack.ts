import { createRequire } from 'node:module';
import type { PluginOptions } from './options';

const require = createRequire(import.meta.url);
export default class FluenticI18nPlugin {
  constructor(private options: PluginOptions = {}) {}
  apply(compiler: any) {
    compiler.options.module.rules.push({
      test: /(?:\.[cm]?[jt]sx?|\.jsonl)$/,
      enforce: 'pre',
      ...(this.options.includeDependencies ? {} : { exclude: /node_modules/ }),
      use: [{ loader: require.resolve('@fluentic/i18n/plugin/webpack-loader'), options: this.options }],
    });
  }
}
