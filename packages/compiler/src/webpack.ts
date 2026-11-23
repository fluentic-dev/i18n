import { createRequire } from 'node:module';
import { createTransformFilter } from './filter';
import { loadOptions, type PluginOptions } from './options';

const require = createRequire(import.meta.url);
export default class FluenticI18nPlugin {
  constructor(private options: PluginOptions = {}) {}
  apply(compiler: any) {
    const filter = this.options.config
      ? (id: string) => createTransformFilter(loadOptions(this.options, compiler.context))(id)
      : createTransformFilter(this.options);
    compiler.options.module.rules.push({
      test: filter,
      enforce: 'pre',
      use: [{ loader: require.resolve('@fluentic/i18n-compiler/webpack-loader'), options: this.options }],
    });
  }
}
