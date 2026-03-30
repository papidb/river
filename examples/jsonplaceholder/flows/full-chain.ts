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
  await river.run(getUsers)
  await river.run(getUserPosts)

  const firstPost = river.state.get<{ id: number; title: string }>('posts.first')
  if (firstPost) {
    const res = await river.http.get<Comment[]>(`/posts/${firstPost.id}/comments`)
    river.state.set('comments.list', res.data)
    river.log(`Post "${firstPost.title}" has ${res.data.length} comments`)
  }

  await river.run(createPost)

  river.log('Full chain complete')
})
