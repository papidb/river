import { flow } from '../../../src/index.js'
import getUsers from './get-users.js'

interface Post {
  userId: number
  id: number
  title: string
  body: string
}

export default flow('get-user-posts', async (river) => {
  // Run get-users first to have user data available
  await river.run(getUsers)

  const firstUser = river.state.get<{ id: number; name: string }>('users.first')
  if (!firstUser) {
    river.log('No users found — skipping')
    return
  }

  const res = await river.http.get<Post[]>(`/posts?userId=${firstUser.id}`)

  river.state.set('posts.list', res.data)
  river.state.set('posts.first', res.data[0])

  river.log(`User "${firstUser.name}" has ${res.data.length} posts`)
  if (res.data.length > 0) {
    river.log(`First post: "${res.data[0].title}"`)
  }
})
