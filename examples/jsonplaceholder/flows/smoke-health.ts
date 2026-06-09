import { flow } from '../../../src/index.js'

interface User {
  id: number
  name: string
  email: string
}

export default flow('smoke-health', async (river) => {
  const res = await river.http.get<User[]>('/users')

  river.assert.equal(res.status, 200)
  river.assert.ok(Array.isArray(res.data), 'expected array of users')
  river.assert.ok(res.data.length > 0, 'expected at least one user')

  const first = res.data[0]
  river.assert.ok(first.id, 'user should have an id')
  river.assert.ok(first.name, 'user should have a name')
  river.assert.ok(first.email, 'user should have an email')

  river.log(`API healthy — ${res.data.length} users, first: ${first.name}`)
})
