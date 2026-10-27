import { defineConfig } from 'tsdown';

export default defineConfig([{
  entry: {
    compiled: 'src/compiled.ts',
    compiler: 'src/compiler/index.ts',
    'plugin/babel': 'src/plugin/babel.ts',
    'plugin/vite': 'src/plugin/vite.ts',
    'plugin/rollup': 'src/plugin/rollup.ts',
    'plugin/esbuild': 'src/plugin/esbuild.ts',
    'plugin/webpack': 'src/plugin/webpack.ts',
    'plugin/webpack-loader': 'src/plugin/webpack-loader.ts',
    index: 'src/index.ts',
    adapter: 'src/adapter.ts',
    react: 'src/react.ts',
    types: 'src/types.ts',
    'core/index': 'src/core/index.ts',
  },
  dts: true,
  format: ['esm'],
  clean: true,
  sourcemap: true,
  platform: 'neutral',
  deps: { neverBundle: ['intl-messageformat', 'react'] },
}, {
  entry: { babel: 'src/plugin/babel.ts' },
  format: ['cjs'],
  outDir: 'dist-cjs',
  dts: false,
  sourcemap: true,
  platform: 'node',
}]);
