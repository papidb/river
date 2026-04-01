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
  },
  "devDependencies": {
    "@types/node": "^24.5.2",
    "typescript": "^5.9.2"
  }
}
`
}
