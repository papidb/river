# River Skills

This file captures the practical usage patterns and mental models that make River effective.

## 1. Core mental model

River flows are workflow functions with access to a shared runtime context.

- Use **flow input/output** for explicit contracts between flows.
- Use **`river.*` namespaces** for runtime capabilities and shared memory.

Rule of thumb:

> Use args/returns for what a flow **means**.
> Use `river.*` for what a flow **needs from the runtime**.

## 2. The runtime surface

Available inside flows:

- `river.http.get/post/put/delete/patch`
- `river.headers.set/remove`
- `river.state.set/get`
- `river.store.save/load`
- `river.env()`
- `river.run()`
- `river.log()`

## 3. Two valid flow styles

### No-input flow

```ts
import { flow } from '@papidb/river'

export default flow('health-check', async (river) => {
  const res = await river.http.get('/health')
  river.log(`Status: ${res.status}`)
})
```

### Function-like flow

```ts
import { flow } from '@papidb/river'

type GetUserInput = { id: number }
type GetUserOutput = { user: { id: number; name: string } }

export default flow<GetUserInput, GetUserOutput>('get-user', async (river, input) => {
  const res = await river.http.get<GetUserOutput['user']>(`/users/${input.id}`)
  return { user: res.data }
})
```

## 4. Composition pattern

```ts
const users = await river.run(getUsers, {})
const posts = await river.run(getUserPosts, {
  userId: users.firstUser?.id,
  userName: users.firstUser?.name,
})
```

## 5. When to use each data channel

### Flow input/output
Use for:
- step contracts
- caller-provided payloads
- returned values for composition
- testable business logic

### `river.state`
Use for:
- ephemeral, in-run coordination
- shared scratchpad data
- transient intermediate values

### `river.store`
Use for:
- cross-run persistence
- checkpointing
- idempotency helpers

### `river.env`
Use for:
- secrets
- deployment/runtime configuration
- base URLs, credentials, API keys

## 6. CLI usage

After global install:

```bash
npm install -g @papidb/river
river --help
river init my-api-flows
river run health-check
```

Without global install:

```bash
npx @papidb/river init my-api-flows
```

## 7. Local development workflow

From this repo:

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm dev -- --help
```

Run the example flows:

```bash
cd examples/jsonplaceholder
pnpm dev -- run full-chain
pnpm dev -- run full-chain-failure
pnpm dev -- run full-chain-mid-failure
```

## 8. Current examples

Public example flows live in:

```txt
examples/jsonplaceholder/flows/
```

They demonstrate:
- success path
- fail-at-end path
- fail-in-middle path
- explicit flow return composition
- shared-state coexistence
