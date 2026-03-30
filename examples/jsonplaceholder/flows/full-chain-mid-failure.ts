import { flow } from '../../../src/index.js'
import getUsers from './get-users.js'

export default flow(
  { name: 'full-chain-mid-failure', description: 'Succeed on the first flow, fail in the middle, and stop before later work' },
  async (vivr) => {
    await vivr.run(getUsers)

    const firstUser = vivr.state.get<{ id: number; name: string }>('users.first')
    if (firstUser) {
      vivr.log(`Loaded user: ${firstUser.name}`)
    }

    await vivr.http.get('https://jsonplaceholder.typicode.com/not-a-real-posts-endpoint')

    vivr.log('This line should never run')
    await vivr.http.post('/posts', {
      title: 'Should not be created',
      body: 'If you see this request, stop-on-failure is broken',
      userId: firstUser?.id ?? 1,
    })
  },
)
