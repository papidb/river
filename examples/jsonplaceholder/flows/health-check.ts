import { flow } from '../../../src/index.js'

export default flow('health-check', async (river) => {
  const res = await river.http.get<unknown[]>('/users')
  river.log(`API is up — ${res.data.length} users available`)
})
