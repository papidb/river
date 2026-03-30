import { flow } from '../../../src/index.js'

interface User {
  id: number
  name: string
  username: string
  email: string
}

export default flow({ name: 'get-users', cache: true }, async (vivr) => {
  const res = await vivr.http.get<User[]>('/users')

  vivr.state.set('users.list', res.data)
  vivr.state.set('users.count', res.data.length)
  vivr.state.set('users.first', res.data[0])

  vivr.log(`Fetched ${res.data.length} users`)
  vivr.log(`First user: ${res.data[0].name} (${res.data[0].email})`)
})
