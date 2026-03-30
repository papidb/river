export function packageTemplate(projectName: string, dependencySpec: string): string {
  return `{
  "name": "${projectName}",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "rivr run health-check"
  },
  "dependencies": {
    "@papidb/rivr": "${dependencySpec}"
  }
}
`
}
