# vivr

TypeScript-first API workflow orchestration for developers.

`vivr` sits between a test runner and an API client. Instead of writing one-off scripts or manually clicking through requests, you define reusable flows in TypeScript, compose them, pass data between them, and run them from the CLI.

## Status

`vivr` is currently an **early preview**.

What works today:
- `vivr run <flow>`
- TypeScript flow files
- namespaced runtime context: `vivr.http.*`, `vivr.headers.*`, `vivr.state.*`, `vivr.store.*`
- flow composition with `vivr.run(otherFlow)`
- in-run state sharing
- flow caching with `cache: true`
- public example flows under `examples/jsonplaceholder/`

What is still in progress:
- `vivr init`
- `vivr list`
- persistent disk-backed store
- verbose / JSON output modes
- declarative flow execution

## Why vivr?

Most tools force you into one of two modes:

- **API clients** are great for manual exploration, but awkward for repeatable multi-step setup.
- **test runners** are great for assertions, but not ideal when your real goal is to bootstrap data, log in, chain requests, and move on.

`vivr` is for the in-between case:

- log in
- create or fetch setup data
- chain outputs into later calls
- compose flows into bigger workflows
- keep the whole thing in regular TypeScript

## Core idea

Each flow is an async function.

```ts
import { flow } from 'vivr'

export default flow('login', async (vivr) => {
  const res = await vivr.http.post<{ token: string }>('/auth/login', {
    email: vivr.env('AUTH_EMAIL'),
    password: vivr.env('AUTH_PASSWORD'),
  })

  vivr.headers.set('Authorization', `Bearer ${res.data.token}`)
  vivr.state.set('login.token', res.data.token)
})
```

The runtime context is namespaced for clarity:

- `vivr.http.get/post/put/delete/patch`
- `vivr.headers.set/remove`
- `vivr.state.set/get` for in-run state
- `vivr.store.save/load` for persistent state API surface
- `vivr.env()`
- `vivr.run(otherFlow)`
- `vivr.log()`

## Example

```ts
import { flow } from 'vivr'

export default flow('health-check', async (vivr) => {
  const res = await vivr.http.get('/get')
  vivr.log(`Status: ${res.status}`)
})
```

CLI output:

```txt
vivr ▸ health-check (dev)
✓ health-check  200  2527ms
Status: 200
1 step completed in 2527ms · all passed
```

## Running vivr locally

From this repository:

```bash
pnpm install
pnpm typecheck
pnpm dev -- --help
```

Run a flow from a project directory:

```bash
npx tsx /absolute/path/to/vivr/bin/vivr.ts run health-check
```

Or from this repository's example:

```bash
cd examples/jsonplaceholder
npx tsx /absolute/path/to/vivr/bin/vivr.ts run full-chain
```

## Minimal project structure

Today, you create the project files manually.

```txt
my-api-project/
├── vivr.config.ts
└── flows/
    └── health-check.ts
```

### `vivr.config.ts`

```ts
import { defineConfig } from 'vivr'

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
import { flow } from 'vivr'

export default flow('health-check', async (vivr) => {
  const res = await vivr.http.get('/get')
  vivr.log(`Status: ${res.status}`)
})
```

Run it:

```bash
vivr run health-check
```

## Public examples

The repository ships with public examples against JSONPlaceholder so anyone can run them.

Directory:

```txt
examples/jsonplaceholder/
├── vivr.config.ts
└── flows/
    ├── health-check.ts
    ├── get-users.ts
    ├── get-user-posts.ts
    ├── create-post.ts
    └── full-chain.ts
```

### What they demonstrate

- `health-check.ts` — simple GET request
- `get-users.ts` — fetch users and store values in state
- `get-user-posts.ts` — compose another flow, then chain response data into the next request
- `create-post.ts` — POST request using data from earlier flow state
- `full-chain.ts` — pipeline-style orchestration across multiple flows

### Run the full example

```bash
cd examples/jsonplaceholder
npx tsx /absolute/path/to/vivr/bin/vivr.ts run full-chain
```

Expected shape of the output:

```txt
vivr ▸ full-chain (dev)
✓ get-users  200  ...ms
↷ get-users (cached)
✓ get-user-posts  200  ...ms
✓ full-chain  200  ...ms
✓ create-post  201  ...ms
4 steps completed in ...ms · all passed
```

## Error handling

`vivr` stops on failure by default.

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

- `vivr run <flow>`

Planned next:

- `vivr init`
- `vivr list`
- `vivr state ...`
- `--verbose`
- `--json`

## Development

Useful commands in this repo:

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm test
pnpm dev -- --help
```

## Design notes

- TypeScript is the primary authoring format
- flows compose through normal imports
- state is namespaced at the API level, not hidden behind globals
- examples use public APIs so the project can stay open-source friendly

## Roadmap

Short-term:

1. polish docs and output further
2. add `vivr list`
3. add persistent JSON-backed store
4. add `vivr init`
5. add verbose and machine-readable output

Longer-term:

1. declarative flow support
2. runtime validation hooks
3. better packaging and publish flow
