import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    compiled: 'src/compiled.ts',
    'compiler-support': 'src/compiler-support.ts',
    hydration: 'src/hydration.ts',
    index: 'src/index.ts',
    adapter: 'src/adapter.ts',
    react: 'src/react.ts',
    types: 'src/types.ts',
    'core/index': 'src/core/index.ts',
  },
  dts: false,
  format: ['esm'],
  clean: true,
  sourcemap: true,
  platform: 'neutral',
  deps: {
    neverBundle: [
      'intl-messageformat',
      'react',
    ],
  },
});
