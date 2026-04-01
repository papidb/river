import { flow } from '../../../src/index.js'
import getUsers from './get-users.js'

interface Post {
  userId: number
  id: number
  title: string
  body: string
}

interface GetUserPostsInput {
  userId?: number
  userName?: string
}

interface GetUserPostsOutput {
  posts: Post[]
  firstPost?: Post
}

export default flow<GetUserPostsInput, GetUserPostsOutput>('get-user-posts', async (river, input) => {
  const usersResult = input.userId
    ? undefined
    : await river.run(getUsers, {})

  const resolvedUserId = input.userId ?? usersResult?.firstUser?.id
  const resolvedUserName = input.userName ?? usersResult?.firstUser?.name

  if (!resolvedUserId) {
    river.log('No users found — skipping')
    return { posts: [] }
  }

  const res = await river.http.get<Post[]>(`/posts?userId=${resolvedUserId}`)
  const firstPost = res.data[0]

  river.state.set('posts.list', res.data)
  river.state.set('posts.first', firstPost)

  river.log(`User "${resolvedUserName ?? String(resolvedUserId)}" has ${res.data.length} posts`)
  if (firstPost) {
    river.log(`First post: "${firstPost.title}"`)
  }

  return {
    posts: res.data,
    firstPost,
  }
})
