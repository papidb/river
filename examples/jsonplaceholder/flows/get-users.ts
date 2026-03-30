import { flow } from '../../../src/index.js'

interface User {
  id: number
  name: string
  username: string
  email: string
}

export default flow({ name: 'get-users', cache: true }, async (river) => {
  const res = await river.http.get<User[]>('/users')

  river.state.set('users.list', res.data)
  river.state.set('users.count', res.data.length)
  river.state.set('users.first', res.data[0])

  river.log(`Fetched ${res.data.length} users`)
  river.log(`First user: ${res.data[0].name} (${res.data[0].email})`)
})
