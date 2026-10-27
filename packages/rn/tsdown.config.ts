import { defineConfig } from 'tsdown';
export default defineConfig([{ entry: ['src/index.ts', 'src/babel.ts'], format: ['esm'], dts: true, sourcemap: true }, {
  entry: { babel: 'src/babel.ts' },
  format: ['cjs'],
  outDir: 'dist-cjs',
  dts: false,
  sourcemap: true,
  platform: 'node',
}]);
