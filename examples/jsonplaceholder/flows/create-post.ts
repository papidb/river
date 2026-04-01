import { flow } from '../../../src/index.js'
import getUsers from './get-users.js'

interface CreatedPost {
  id: number
  title: string
  body: string
  userId: number
}

interface CreatePostInput {
  userId?: number
  userName?: string
  title?: string
  body?: string
}

export default flow<CreatePostInput, CreatedPost | undefined>('create-post', async (river, input) => {
  const usersResult = input.userId
    ? undefined
    : await river.run(getUsers, {})

  const resolvedUserId = input.userId ?? usersResult?.firstUser?.id
  const resolvedUserName = input.userName ?? usersResult?.firstUser?.name

  if (!resolvedUserId) {
    river.log('No users found — skipping')
    return
  }

  const res = await river.http.post<CreatedPost>('/posts', {
    title: input.title ?? 'Hello from river',
    body: input.body ?? 'This post was created by a river flow',
    userId: resolvedUserId,
  })

  river.state.set('post.created', res.data)
  if (resolvedUserName) {
    river.log(`Created post for ${resolvedUserName}`)
  }
  river.log(`Created post #${res.data.id}: "${res.data.title}"`)

  return res.data
})
