# river

TypeScript-first API workflow orchestration for developers.

`river` sits between a test runner and an API client. Instead of writing one-off scripts or manually clicking through requests, you define reusable flows in TypeScript, compose them, pass data between them, and run them from the CLI.

## Why river?

Most tools force you into one of two modes:

- **API clients** are great for manual exploration, but awkward for repeatable multi-step setup.
- **test runners** are great for assertions, but not ideal when your real goal is to bootstrap data, log in, chain requests, and move on.

`river` is for the in-between case:

- log in
- create or fetch setup data
- chain outputs into later calls
- compose flows into bigger workflows
- keep the whole thing in regular TypeScript

## Core idea

Each flow is an async function.

River supports **both** of these styles:

1. **no-input flows**
2. **function-like flows with explicit input/output**

Shared runtime context remains available in both.

```ts
import { flow } from '@papidb/river'

export default flow('login', async (river) => {
  const res = await river.http.post<{ token: string }>('/auth/login', {
    email: river.env('AUTH_EMAIL'),
    password: river.env('AUTH_PASSWORD'),
  })

  river.headers.set('Authorization', `Bearer ${res.data.token}`)
  river.state.set('login.token', res.data.token)
})
```

And now River also supports flows that behave more like normal functions:

```ts
import { flow } from '@papidb/river'

type GetUserInput = { id: number }
type GetUserOutput = { user: { id: number; name: string } }

export default flow<GetUserInput, GetUserOutput>('get-user', async (river, input) => {
  const res = await river.http.get<GetUserOutput['user']>(`/users/${input.id}`)

  river.state.set('last.user', res.data)

  return { user: res.data }
})
```

Composition can then use explicit return values:

```ts
const result = await river.run(getUser, { id: 1 })
console.log(result.user.name)
```

## How to think about data flow

Use each mechanism for a different job:

- **flow input/output** → the explicit contract of a flow
- **`river.state`** → ephemeral shared state during one run
- **`river.store`** → persistent shared state across runs
- **`river.env`** → secrets and runtime configuration
- **`river.http` / `river.headers` / `river.log`** → runtime capabilities

Rule of thumb:

> Use args/returns for what a flow **means**.
> Use `river.*` for what a flow **needs from the runtime**.

The runtime context is namespaced for clarity:

- `river.http.get/post/put/delete/patch`
- `river.headers.set/remove`
- `river.state.set/get` for in-run state
- `river.store.save/load` for persistent state API surface
- `river.env()`
- `river.run(otherFlow)`
- `river.log()`

## Example

```ts
import { flow } from '@papidb/river'

export default flow('health-check', async (river) => {
  const res = await river.http.get('/get')
  river.log(`Status: ${res.status}`)
})
```

CLI output:

```txt
river ▸ health-check (dev)
✓ health-check  200  2527ms
Status: 200
1 step completed in 2527ms · all passed
```

## Install

### Global install

This should be the normal way to use River:

```bash
pnpm install -g @papidb/river
```

Then use the CLI directly:

```bash
river --help
river init my-api-flows
cd my-api-flows
pnpm install
river run health-check
```

### Package and CLI names

- **npm package**: `@papidb/river`
- **import path**: `@papidb/river`
- **CLI command**: `river`

If you do not want a global install, you can still run it with `npx`:

```bash
npx @papidb/river init my-api-flows
```

And inside TypeScript projects you import it like this:

```ts
import { flow, defineConfig } from '@papidb/river'
```

## Developing River locally

From this repository:

```bash
pnpm install
pnpm typecheck
pnpm dev -- --help
```

For normal usage after install, prefer the real CLI:

```bash
river run health-check
```

When working inside this repository before a global install, use the dev script:

```bash
pnpm dev -- run health-check
```

Or from this repository's example:

```bash
cd examples/jsonplaceholder
river run full-chain
```

## Getting started with `river init`

Scaffold a minimal project with a single health-check flow:

```bash
npx @papidb/river init my-api-flows
```

You can also provide defaults non-interactively:

```bash
npx @papidb/river init my-api-flows --yes --base-url http://localhost:4000
```

If you are creating the river project inside another git repository and you do **not** want to commit it, use:

```bash
npx @papidb/river init api-flows --git-exclude
```

That adds the generated folder to the nearest parent repository's `.git/info/exclude`.

For local development of river itself, there is also:

```bash
npx @papidb/river init api-flows --local
```

That uses a local `file:` dependency instead of the published npm version.

## Minimal project structure

```txt
my-api-project/
├── river.config.ts
├── environments/
│   └── dev.env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── flows/
    └── health-check.ts
```

### `river.config.ts`

```ts
import { defineConfig } from '@papidb/river'

export default defineConfig({
  environments: {
    dev: {
      baseUrl: 'https://httpbin.org',
    },
  },
  defaultEnv: 'dev',
  defaults: {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  },
})
```

### `flows/health-check.ts`

```ts
import { flow } from '@papidb/river'

export default flow('health-check', async (river) => {
  const res = await river.http.get('/get')
  river.log(`Status: ${res.status}`)
})
```

Run it:

```bash
pnpm install
river run health-check
```

## Public examples

The repository ships with public examples against JSONPlaceholder so anyone can run them.

Directory:

```txt
examples/jsonplaceholder/
├── river.config.ts
└── flows/
    ├── health-check.ts
    ├── get-users.ts
    ├── get-user-posts.ts
    ├── create-post.ts
    ├── full-chain.ts
    ├── full-chain-failure.ts
    └── full-chain-mid-failure.ts
```

### What they demonstrate

- `health-check.ts` — simple GET request
- `get-users.ts` — fetch users and store values in state
- `get-user-posts.ts` — compose another flow, then chain response data into the next request
- `create-post.ts` — POST request using data from earlier flow state
- `full-chain.ts` — pipeline-style orchestration across multiple flows
- `full-chain-failure.ts` — realistic failure pipeline that succeeds through setup steps and then dies on a bad endpoint
- `full-chain-mid-failure.ts` — succeeds on the first step, fails in the middle, and proves later work does not run

### Run the full example

```bash
cd examples/jsonplaceholder
river run full-chain
```

### Run the failure example

```bash
cd examples/jsonplaceholder
river run full-chain-failure
```

### Run the mid-flow failure example

```bash
cd examples/jsonplaceholder
river run full-chain-mid-failure
```

Expected shape of the mid-flow failure output:

```txt
river ▸ full-chain-mid-failure (dev)
✓ get-users  200  ...ms
Loaded user: Leanne Graham
✓ full-chain-mid-failure  404  ...ms
2 steps completed in ...ms · failed

ERROR  Flow failed: full-chain-mid-failure
GET https://jsonplaceholder.typicode.com/not-a-real-posts-endpoint
HTTP 404 Not Found in ...ms
Response:
{}
```

The important part: anything after the failing request does not run.

Expected shape of the failure output:

```txt
river ▸ full-chain-failure (dev)
✓ get-users  200  ...ms
↷ get-users (cached)
✓ get-user-posts  200  ...ms
About to fail after loading post: "..."
✓ full-chain-failure  404  ...ms
3 steps completed in ...ms · failed

ERROR  Flow failed: full-chain-failure
GET https://jsonplaceholder.typicode.com/not-a-real-endpoint
HTTP 404 Not Found in ...ms
Response:
{}
```

Expected shape of the output:

```txt
river ▸ full-chain (dev)
✓ get-users  200  ...ms
↷ get-users (cached)
✓ get-user-posts  200  ...ms
✓ full-chain  200  ...ms
✓ create-post  201  ...ms
4 steps completed in ...ms · all passed
```

## Error handling

`river` stops on failure by default.

If a request fails, the CLI now prints the useful parts of the failure:

- flow name
- HTTP method and URL
- status code
- duration
- response body excerpt

Example shape:

```txt
Flow failed: create-post
POST https://api.example.com/posts
HTTP 401 Unauthorized in 214ms
Response:
{
  "message": "Unauthorized"
}
```

## Current command surface

Implemented now:

- `river init [name]`
- `river run <flow>`

Planned next:

- `river list`
- `river state ...`
- `--verbose`
- `--json`

## Status

`river` is currently an **early preview**.

What works today:

- `river init [name]`
- `river run <flow>`
- TypeScript flow files
- namespaced runtime context: `river.http.*`, `river.headers.*`, `river.state.*`, `river.store.*`
- flow composition with `river.run(otherFlow)`
- in-run state sharing
- flow caching with `cache: true`
- public example flows under `examples/jsonplaceholder/`

What is still in progress:

- `river list`
- persistent disk-backed store
- verbose / JSON output modes
- declarative flow execution
