import { flow } from '../../../src/index.js'
import getUsers from './get-users.js'
import getUserPosts from './get-user-posts.js'

export default flow(
  { name: 'full-chain-failure', description: 'Fetch users, fetch posts, then fail against a wrong endpoint' },
  async (vivr) => {
    await vivr.run(getUsers)
    await vivr.run(getUserPosts)

    const firstPost = vivr.state.get<{ id: number; title: string }>('posts.first')
    if (firstPost) {
      vivr.log(`About to fail after loading post: "${firstPost.title}"`)
    }

    await vivr.http.get('https://jsonplaceholder.typicode.com/not-a-real-endpoint')
  },
)
