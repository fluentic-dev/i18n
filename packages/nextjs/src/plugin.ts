import FluenticPlugin from '@fluentic/i18n/plugin/webpack';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';
const require = createRequire(import.meta.url);
export type NextPluginOptions = { requestConfig: string; config?: string; compiled?: boolean; };
/** One Next integration; preserves the application's existing webpack hook/rules. */
export default function withFluentic(options: NextPluginOptions) {
  const request = resolve(options.requestConfig);
  const loader = require.resolve('@fluentic/i18n/plugin/webpack-loader');
  const compilerOptions = {
    ...(options.config ? { config: resolve(options.config) } : {}),
    ...(options.compiled !== undefined ? { compiled: options.compiled } : {}),
  };
  return (nextConfig: any = {}) => ({
    ...nextConfig,
    turbopack: {
      ...nextConfig.turbopack,
      resolveAlias: {
        ...nextConfig.turbopack?.resolveAlias,
        '@fluentic/i18n-nextjs/request': './' + relative(process.cwd(), request).replace(/\\/g, '/'),
      },
      rules: {
        ...nextConfig.turbopack?.rules,
        ...Object.fromEntries(['*.js', '*.jsx', '*.ts', '*.tsx', '*.mjs', '*.mts'].map((pattern) => [pattern, [
          ...(nextConfig.turbopack?.rules?.[pattern] ? [nextConfig.turbopack.rules[pattern]].flat() : []),
          { condition: { not: 'foreign' }, loaders: [{ loader, options: compilerOptions }] },
        ]])),
        '*.jsonl': { loaders: [{ loader, options: compilerOptions }], as: '*.js' },
      },
    },
    webpack(config: any, context: any) {
      config.resolve ??= {};
      config.resolve.alias ??= {};
      config.resolve.alias['@fluentic/i18n-nextjs/request$'] = request;
      config.plugins ??= [];
      config.plugins.push(new FluenticPlugin(compilerOptions));
      return nextConfig.webpack ? nextConfig.webpack(config, context) : config;
    },
  });
}
