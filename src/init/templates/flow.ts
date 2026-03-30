export function healthCheckFlowTemplate(): string {
  return `import { flow } from '@papidb/river'

export default flow('health-check', async (river) => {
  const res = await river.http.get('/health')
  river.log(\`Status: \${res.status}\`)
})
`
}
