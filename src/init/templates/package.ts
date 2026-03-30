export function packageTemplate(projectName: string, dependencySpec: string): string {
  return `{
  "name": "${projectName}",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vivr run health-check"
  },
  "dependencies": {
    "vivr": "${dependencySpec}"
  }
}
`
}
