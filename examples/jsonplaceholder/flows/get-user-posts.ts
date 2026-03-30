import { flow } from '../../../src/index.js'
import getUsers from './get-users.js'

interface Post {
  userId: number
  id: number
  title: string
  body: string
}

export default flow('get-user-posts', async (vivr) => {
  // Run get-users first to have user data available
  await vivr.run(getUsers)

  const firstUser = vivr.state.get<{ id: number; name: string }>('users.first')
  if (!firstUser) {
    vivr.log('No users found — skipping')
    return
  }

  const res = await vivr.http.get<Post[]>(`/posts?userId=${firstUser.id}`)

  vivr.state.set('posts.list', res.data)
  vivr.state.set('posts.first', res.data[0])

  vivr.log(`User "${firstUser.name}" has ${res.data.length} posts`)
  if (res.data.length > 0) {
    vivr.log(`First post: "${res.data[0].title}"`)
  }
})
