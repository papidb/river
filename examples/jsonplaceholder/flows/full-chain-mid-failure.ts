import { flow } from '../../../src/index.js'
import getUsers from './get-users.js'

export default flow(
  { name: 'full-chain-mid-failure', description: 'Succeed on the first flow, fail in the middle, and stop before later work' },
  async (river) => {
    await river.run(getUsers)

    const firstUser = river.state.get<{ id: number; name: string }>('users.first')
    if (firstUser) {
      river.log(`Loaded user: ${firstUser.name}`)
    }

    await river.http.get('https://jsonplaceholder.typicode.com/not-a-real-posts-endpoint')

    river.log('This line should never run')
    await river.http.post('/posts', {
      title: 'Should not be created',
      body: 'If you see this request, stop-on-failure is broken',
      userId: firstUser?.id ?? 1,
    })
  },
)
