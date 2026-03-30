export function healthCheckFlowTemplate(): string {
  return `import { flow } from 'vivr'

export default flow('health-check', async (vivr) => {
  const res = await vivr.http.get('/health')
  vivr.log(\`Status: \${res.status}\`)
})
`
}
