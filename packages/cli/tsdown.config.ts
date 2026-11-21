import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    translators: 'src/translators.ts',
    converters: 'src/converter-api.ts',
    bin: 'src/bin.ts',
  },
  dts: false,
  format: ['esm'],
  clean: true,
  sourcemap: true,
  platform: 'node',
});
