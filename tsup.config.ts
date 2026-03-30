import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'bin/vivr.ts'],
  format: ['esm'],
  dts: { entry: 'src/index.ts' },
  clean: true,
  splitting: true,
  outExtension: () => ({ js: '.mjs' }),
})
