import { flow } from '../../../src/index.js'
import getUsers from './get-users.js'

interface CreatedPost {
  id: number
  title: string
  body: string
  userId: number
}

export default flow('create-post', async (river) => {
  await river.run(getUsers)

  const firstUser = river.state.get<{ id: number; name: string }>('users.first')
  if (!firstUser) {
    river.log('No users found — skipping')
    return
  }

  const res = await river.http.post<CreatedPost>('/posts', {
    title: 'Hello from river',
    body: 'This post was created by a river flow',
    userId: firstUser.id,
  })

  river.state.set('post.created', res.data)
  river.log(`Created post #${res.data.id}: "${res.data.title}"`)
})
