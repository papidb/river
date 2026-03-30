export function packageTemplate(projectName: string, dependencySpec: string): string {
  return `{
  "name": "${projectName}",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "river run health-check"
  },
  "dependencies": {
    "@papidb/river": "${dependencySpec}"
  }
}
`
}
