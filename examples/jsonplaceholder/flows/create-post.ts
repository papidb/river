import { flow } from '../../../src/index.js'
import getUsers from './get-users.js'

interface CreatedPost {
  id: number
  title: string
  body: string
  userId: number
}

export default flow('create-post', async (vivr) => {
  await vivr.run(getUsers)

  const firstUser = vivr.state.get<{ id: number; name: string }>('users.first')
  if (!firstUser) {
    vivr.log('No users found — skipping')
    return
  }

  const res = await vivr.http.post<CreatedPost>('/posts', {
    title: 'Hello from vivr',
    body: 'This post was created by a vivr flow',
    userId: firstUser.id,
  })

  vivr.state.set('post.created', res.data)
  vivr.log(`Created post #${res.data.id}: "${res.data.title}"`)
})
