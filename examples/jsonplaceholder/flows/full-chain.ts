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

export default flow({ name: 'full-chain', description: 'Fetch users → posts → comments → create post' }, async (vivr) => {
  await vivr.run(getUsers)
  await vivr.run(getUserPosts)

  const firstPost = vivr.state.get<{ id: number; title: string }>('posts.first')
  if (firstPost) {
    const res = await vivr.http.get<Comment[]>(`/posts/${firstPost.id}/comments`)
    vivr.state.set('comments.list', res.data)
    vivr.log(`Post "${firstPost.title}" has ${res.data.length} comments`)
  }

  await vivr.run(createPost)

  vivr.log('Full chain complete')
})
