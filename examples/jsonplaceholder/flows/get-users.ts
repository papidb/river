import { flow } from '../../../src/index.js'

interface User {
  id: number
  name: string
  username: string
  email: string
}

interface GetUsersOutput {
  users: User[]
  firstUser?: User
}

export default flow<Record<string, never>, GetUsersOutput>({ name: 'get-users', cache: true }, async (river) => {
  const res = await river.http.get<User[]>('/users')
  const firstUser = res.data[0]

  river.state.set('users.list', res.data)
  river.state.set('users.count', res.data.length)
  river.state.set('users.first', firstUser)

  river.log(`Fetched ${res.data.length} users`)
  if (firstUser) {
    river.log(`First user: ${firstUser.name} (${firstUser.email})`)
  }

  return {
    users: res.data,
    firstUser,
  }
})
