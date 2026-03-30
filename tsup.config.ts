import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'bin/river.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  splitting: true,
  outExtension: () => ({ js: '.mjs' }),
})
