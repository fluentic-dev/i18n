import { defineConfig } from 'tsdown';

export default defineConfig([{
  entry: {
    index: 'src/index.ts',
    babel: 'src/babel.ts',
    vite: 'src/vite.ts',
    rollup: 'src/rollup.ts',
    esbuild: 'src/esbuild.ts',
    webpack: 'src/webpack.ts',
    'webpack-loader': 'src/webpack-loader.ts',
    nextjs: 'src/nextjs.ts',
  },
  dts: false,
  format: ['esm'],
  clean: true,
  sourcemap: true,
  platform: 'node',
}, {
  entry: { babel: 'src/babel.ts' },
  format: ['cjs'],
  outDir: 'dist-cjs',
  dts: false,
  sourcemap: true,
  platform: 'node',
}]);
