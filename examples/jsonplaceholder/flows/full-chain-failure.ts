import { flow } from '../../../src/index.js'
import getUsers from './get-users.js'
import getUserPosts from './get-user-posts.js'

export default flow(
  { name: 'full-chain-failure', description: 'Fetch users, fetch posts, then fail against a wrong endpoint' },
  async (river) => {
    await river.run(getUsers)
    await river.run(getUserPosts)

    const firstPost = river.state.get<{ id: number; title: string }>('posts.first')
    if (firstPost) {
      river.log(`About to fail after loading post: "${firstPost.title}"`)
    }

    await river.http.get('https://jsonplaceholder.typicode.com/not-a-real-endpoint')
  },
)
