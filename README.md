# rivr

TypeScript-first API workflow orchestration for developers.

`rivr` sits between a test runner and an API client. Instead of writing one-off scripts or manually clicking through requests, you define reusable flows in TypeScript, compose them, pass data between them, and run them from the CLI.

## Status

`rivr` is currently an **early preview**.

What works today:
- `rivr init [name]`
- `rivr run <flow>`
- TypeScript flow files
- namespaced runtime context: `rivr.http.*`, `rivr.headers.*`, `rivr.state.*`, `rivr.store.*`
- flow composition with `rivr.run(otherFlow)`
- in-run state sharing
- flow caching with `cache: true`
- public example flows under `examples/jsonplaceholder/`

What is still in progress:
- `vivr list`
- persistent disk-backed store
- verbose / JSON output modes
- declarative flow execution

## Why rivr?

Most tools force you into one of two modes:

- **API clients** are great for manual exploration, but awkward for repeatable multi-step setup.
- **test runners** are great for assertions, but not ideal when your real goal is to bootstrap data, log in, chain requests, and move on.

`rivr` is for the in-between case:

- log in
- create or fetch setup data
- chain outputs into later calls
- compose flows into bigger workflows
- keep the whole thing in regular TypeScript

## Core idea

Each flow is an async function.

```ts
import { flow } from 'rivr'

export default flow('login', async (rivr) => {
  const res = await rivr.http.post<{ token: string }>('/auth/login', {
    email: rivr.env('AUTH_EMAIL'),
    password: rivr.env('AUTH_PASSWORD'),
  })

  rivr.headers.set('Authorization', `Bearer ${res.data.token}`)
  rivr.state.set('login.token', res.data.token)
})
```

The runtime context is namespaced for clarity:

- `rivr.http.get/post/put/delete/patch`
- `rivr.headers.set/remove`
- `rivr.state.set/get` for in-run state
- `rivr.store.save/load` for persistent state API surface
- `rivr.env()`
- `rivr.run(otherFlow)`
- `rivr.log()`

## Example

```ts
import { flow } from 'rivr'

export default flow('health-check', async (rivr) => {
  const res = await rivr.http.get('/get')
  rivr.log(`Status: ${res.status}`)
})
```

CLI output:

```txt
rivr ▸ health-check (dev)
✓ health-check  200  2527ms
Status: 200
1 step completed in 2527ms · all passed
```

## Package and CLI names

- **npm package**: `rivr`
- **import path**: `rivr`
- **CLI command**: `rivr`

Examples:

```bash
npm install rivr
npx rivr init my-api-flows
```

```ts
import { flow, defineConfig } from 'rivr'
```

After install, the command remains:

```bash
rivr run health-check
```

## Running rivr locally

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

## Getting started with `rivr init`

Scaffold a minimal project with a single health-check flow:

```bash
npx rivr init my-api-flows
```

You can also provide defaults non-interactively:

```bash
npx rivr init my-api-flows --yes --base-url http://localhost:4000
```

If you are creating the rivr project inside another git repository and you do **not** want to commit it, use:

```bash
npx rivr init api-flows --git-exclude
```

That adds the generated folder to the nearest parent repository's `.git/info/exclude`.

For local development of rivr itself, there is also:

```bash
npx rivr init api-flows --local
```

That uses a local `file:` dependency instead of the published npm version.

## Minimal project structure

```txt
my-api-project/
├── vivr.config.ts
├── environments/
│   └── dev.env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── flows/
    └── health-check.ts
```

### `rivr.config.ts`

```ts
import { defineConfig } from 'rivr'

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
import { flow } from 'rivr'

export default flow('health-check', async (rivr) => {
  const res = await rivr.http.get('/get')
  rivr.log(`Status: ${res.status}`)
})
```

Run it:

```bash
pnpm install
rivr run health-check
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
npx tsx /absolute/path/to/vivr/bin/vivr.ts run full-chain
```

### Run the failure example

```bash
cd examples/jsonplaceholder
npx tsx /absolute/path/to/vivr/bin/vivr.ts run full-chain-failure
```

### Run the mid-flow failure example

```bash
cd examples/jsonplaceholder
npx tsx /absolute/path/to/vivr/bin/vivr.ts run full-chain-mid-failure
```

Expected shape of the mid-flow failure output:

```txt
vivr ▸ full-chain-mid-failure (dev)
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
vivr ▸ full-chain-failure (dev)
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

- `vivr init [name]`
- `vivr run <flow>`

Planned next:

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

## Publishing

Because the unscoped name was rejected by npm, the package is published as a scoped public package:

```bash
npm publish --access=public
```

That publishes `rivr`, with the executable command name `rivr`.
