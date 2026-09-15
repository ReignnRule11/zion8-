import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ tsconfigFile: './tsconfig.json' })],
  test: {
    environment: 'node',
    include: ['test/**/*.e2e.test.ts'],
    hookTimeout: 30000,
    testTimeout: 30000,
    fileParallelism: false,
  },
});
