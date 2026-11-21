import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';
import FluenticPlugin from './webpack';
const require = createRequire(import.meta.url);
export type NextPluginOptions = {
  requestConfig: string;
  /** Optional i18n config path, resolved from the application working directory. */
  config?: string;
  /** Direct override; otherwise reuse compiled.hashLength from an explicitly selected config or the default. */
  hashLength?: number;
};
/** One Next integration; preserves the application's existing webpack hook/rules. */
export default function withFluentic(options: NextPluginOptions) {
  const request = resolve(options.requestConfig);
  const loader = require.resolve('@fluentic/i18n-compiler/webpack-loader');
  const compilerOptions = {
    bindReactText: true,
    ...(options.config ? { config: resolve(options.config) } : {}),
    ...(options.hashLength !== undefined ? { hashLength: options.hashLength } : {}),
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
