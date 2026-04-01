import { flow } from '../../../src/index.js'
import getUsers from './get-users.js'
import getUserPosts from './get-user-posts.js'
import createPost from './create-post.js'

interface Comment {
  postId: number
  id: number
  name: string
  email: string
  body: string
}

export default flow({ name: 'full-chain', description: 'Fetch users → posts → comments → create post' }, async (river) => {
  const usersResult = await river.run(getUsers, {})
  const firstUser = usersResult.firstUser

  const postsResult = firstUser
    ? await river.run(getUserPosts, { userId: firstUser.id, userName: firstUser.name })
    : await river.run(getUserPosts, {})

  const firstPost = postsResult.firstPost
  if (firstPost) {
    const res = await river.http.get<Comment[]>(`/posts/${firstPost.id}/comments`)
    river.state.set('comments.list', res.data)
    river.log(`Post "${firstPost.title}" has ${res.data.length} comments`)
  }

  await river.run(createPost, {
    userId: firstUser?.id,
    userName: firstUser?.name,
    title: 'Full chain post from river',
    body: 'Created after fetching users, posts, and comments.',
  })

  river.log('Full chain complete')
})
