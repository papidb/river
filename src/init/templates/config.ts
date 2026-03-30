export function configTemplate(projectName: string, baseUrl: string): string {
  return `import { defineConfig } from '@papidb/rivr'

export default defineConfig({
  name: '${projectName}',
  environments: {
    dev: {
      baseUrl: '${baseUrl}',
    },
  },
  defaultEnv: 'dev',
  defaults: {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  },
})
`
}
