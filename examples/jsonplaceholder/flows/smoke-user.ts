import { flow } from '../../../src/index.js'

interface SmokeUserInput {
  id: string
}

interface User {
  id: number
  name: string
  username: string
  email: string
  phone: string
  website: string
}

export default flow<SmokeUserInput, void>('smoke-user', async (river, input) => {
  river.assert.ok(input.id, 'missing --id argument')

  const res = await river.http.get<User>(`/users/${input.id}`)

  river.assert.equal(res.status, 200)
  river.assert.equal(res.data.id, Number(input.id))
  river.assert.ok(res.data.name, 'user should have a name')
  river.assert.ok(res.data.email, 'user should have an email')
  river.assert.ok(res.data.email.includes('@'), 'email should contain @')

  river.log(`User #${res.data.id}: ${res.data.name} <${res.data.email}>`)
})
