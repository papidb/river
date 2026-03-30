import { flow } from '../../../src/index.js'

export default flow('health-check', async (vivr) => {
  const res = await vivr.http.get('/users')
  vivr.log(`API is up — ${res.data.length} users available`)
})
