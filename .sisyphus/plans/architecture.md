# river — Architecture

> API workflow orchestration CLI for developers.
> Define flows as TypeScript functions. Compose them. Run them against any API.

---

## 1. Overview

**river** is a CLI tool that lets developers define reusable API workflow flows in TypeScript. Unlike test runners (which assert) or API clients (which are manual), river automates multi-step API interactions — login, create resources, chain data, bootstrap environments.

**Mental model**: Each flow is an async function that receives a `river` context object. That object gives you HTTP methods, state management, environment variables, and the ability to call other flows. Pipelines are just flows that compose other flows.

```typescript
import { flow } from 'river'

export default flow('login', async (river) => {
  const res = await river.post<{ token: string }>('/auth/login', {
    email: river.env('EMAIL'),
    password: river.env('PASSWORD'),
  })
  river.setHeader('Authorization', `Bearer ${res.data.token}`)
  river.store('login.token', res.data.token)
})
```

```
$ river run login --env dev
  ✓ login  201  45ms
  1 step completed in 45ms
```

---

## 2. Project Structure (river source code)

```
~/batcave/river/
├── src/
│   ├── index.ts                 # Public SDK exports: flow, defineConfig, types
│   │
│   ├── cli/
│   │   ├── index.ts             # CLI entry point — parse args, route to commands
│   │   ├── commands/
│   │   │   ├── init.ts          # river init [name]
│   │   │   ├── run.ts           # river run <flow> [--env] [--verbose]
│   │   │   └── list.ts          # river list
│   │   └── output/
│   │       ├── reporter.ts      # Reporter interface
│   │       ├── minimal.ts       # Default: ✓ step-name  status  duration
│   │       ├── verbose.ts       # --verbose: + request/response bodies
│   │       └── json.ts          # --json: machine-readable NDJSON
│   │
│   ├── core/
│   │   ├── flow.ts              # flow() factory, Flow interface, isFlow() guard
│   │   ├── context.ts           # RiverContext class — the `river` object
│   │   ├── runner.ts            # FlowRunner — lifecycle, execution, error handling
│   │   ├── loader.ts            # Dynamic import of .ts flow files (jiti/Bun)
│   │   └── errors.ts            # VivHttpError, VivFlowError, VivConfigError
│   │
│   ├── http/
│   │   ├── client.ts            # HTTP client — fetch wrapper, URL resolution, timing
│   │   └── types.ts             # VivResponse, RequestOptions
│   │
│   ├── state/
│   │   ├── memory-store.ts      # In-memory Map<string, unknown> (current run)
│   │   ├── persistent-store.ts  # JSON file read/write (.river/state.json)
│   │   └── types.ts             # StateStore interface
│   │
│   ├── config/
│   │   ├── loader.ts            # Find and import river.config.ts
│   │   ├── env-loader.ts        # Load .env + environments/<env>.env
│   │   └── types.ts             # VivConfig, EnvironmentConfig
│   │
│   └── init/
│       ├── scaffolder.ts        # mkdir, write files, install deps
│       └── templates/           # Raw template strings
│           ├── config.ts        # river.config.ts template
│           ├── flow.ts          # health-check.ts template
│           ├── env.ts           # .env.example template
│           ├── gitignore.ts     # .gitignore template
│           ├── tsconfig.ts      # tsconfig.json template
│           └── package.ts       # package.json template
│
├── bin/
│   └── river.ts                  # #!/usr/bin/env node — entry point
│
├── package.json
├── tsconfig.json
└── README.md
```

### Why this layout
- **`src/index.ts`** — what users import: `import { flow, defineConfig } from 'river'`
- **`src/cli/`** — CLI-only code, not imported by flow authors
- **`src/core/`** — runtime engine, used by both CLI and SDK
- **`src/http/`** — isolated HTTP layer, testable independently
- **`src/state/`** — state backends behind an interface (swap JSON for SQLite later)
- **`src/config/`** — config loading isolated from core logic
- **`src/init/`** — scaffolding templates, only used by `river init`

---

## 3. Scaffolded Project (after `river init`)

```
my-api-project/
├── river.config.ts              # Project configuration (environments, defaults)
├── .env                        # Local secrets — gitignored
├── .env.example                # Template for teammates — committed
├── flows/
│   └── health-check.ts         # Working example that hits GET /health
├── environments/
│   ├── dev.env                 # Dev-specific vars (BASE_URL, etc.)
│   ├── staging.env
│   └── prod.env
├── .river/
│   └── state.json              # Persistent state — gitignored
├── .gitignore
├── package.json                # Has river as dependency
└── tsconfig.json               # Configured for flow authoring
```

### Generated river.config.ts

```typescript
import { defineConfig } from 'river'

export default defineConfig({
  name: 'my-api-project',

  environments: {
    dev: {
      baseUrl: 'http://localhost:3000',  // asked during init
    },
    staging: {
      baseUrl: 'https://staging.example.com',
    },
    prod: {
      baseUrl: 'https://api.example.com',
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

### Generated flows/health-check.ts

```typescript
import { flow } from 'river'

export default flow('health-check', async (river) => {
  const res = await river.get('/health')
  river.log(`Status: ${res.status} — ${JSON.stringify(res.data)}`)
})
```

---

## 4. Core Types

### 4.1 Flow

```typescript
// ── Factory function ──

// Simple form
function flow(name: string, fn: FlowFn): Flow
// Options form
function flow(options: FlowOptions, fn: FlowFn): Flow

type FlowFn = (river: RiverContext) => Promise<void>

interface FlowOptions {
  name: string
  description?: string
  cache?: boolean       // If true, skip re-run when called via river.run() in same session
  timeout?: number      // Per-flow timeout in ms (default: 30000)
}

// ── Flow object (returned by flow()) ──

interface Flow {
  readonly name: string
  readonly options: Required<FlowOptions>  // defaults filled in
  readonly execute: FlowFn
  readonly __brand: 'river-flow'            // runtime type guard
}

function isFlow(value: unknown): value is Flow
function isDeclarativeFlow(value: unknown): value is DeclarativeFlow

// ── Declarative fallback ──

interface DeclarativeFlow {
  name: string
  description?: string
  cache?: boolean
  steps: DeclarativeStep[]
}

interface DeclarativeStep {
  name?: string                            // Display name (defaults to "METHOD /url")
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  headers?: Record<string, string>
  body?: unknown
  extract?: Record<string, string>         // Store extracted values: { "userId": "$.data.id" }
}
```

### 4.2 RiverContext

This is the `river` object passed to every flow function. It's the entire API surface flow authors interact with.

```typescript
interface RiverContext {
  // ── HTTP ──
  get<T = any>(url: string, options?: RequestOptions): Promise<VivResponse<T>>
  post<T = any>(url: string, body?: unknown, options?: RequestOptions): Promise<VivResponse<T>>
  put<T = any>(url: string, body?: unknown, options?: RequestOptions): Promise<VivResponse<T>>
  delete<T = any>(url: string, options?: RequestOptions): Promise<VivResponse<T>>
  patch<T = any>(url: string, body?: unknown, options?: RequestOptions): Promise<VivResponse<T>>

  // ── Session Headers ──
  setHeader(key: string, value: string): void     // Applied to ALL subsequent requests
  removeHeader(key: string): void

  // ── State: In-Memory (dies when flow run ends) ──
  store(key: string, value: unknown): void
  recall<T = unknown>(key: string): T | undefined

  // ── State: Persistent (written to .river/state.json) ──
  save(key: string, value: unknown): void
  load<T = unknown>(key: string): T | undefined

  // ── Environment ──
  env(key: string): string                        // Throws if not found
  env(key: string, fallback: string): string       // Returns fallback if not found

  // ── Composition ──
  run(flow: Flow): Promise<void>                   // Execute another flow in this context

  // ── Output ──
  log(message: string): void                       // User-facing log line

  // ── Metadata (read-only) ──
  readonly environment: string                     // Active env name ("dev", "staging", etc.)
  readonly flowName: string                        // Currently executing flow's name
}
```

### 4.3 HTTP Types

```typescript
interface VivResponse<T = any> {
  status: number
  statusText: string
  headers: Record<string, string>
  data: T                   // Parsed JSON body (or raw text if not JSON)
  duration: number          // Request time in ms
  size: number              // Response body size in bytes
  ok: boolean               // status >= 200 && status < 300
}

interface RequestOptions {
  headers?: Record<string, string>      // Merged with session + config headers
  timeout?: number                      // Override for this request
  schema?: ZodType | TSchema            // Optional runtime validation
  raw?: boolean                         // If true, don't parse JSON — return raw text as data
}
```

### 4.4 Config Types

```typescript
interface VivConfig {
  name?: string
  version?: string
  environments: Record<string, EnvironmentConfig>
  defaultEnv?: string                     // Defaults to first key in environments
  defaults?: {
    headers?: Record<string, string>
    timeout?: number                      // Default: 30000
  }
  flowsDir?: string                       // Default: './flows'
}

interface EnvironmentConfig {
  baseUrl: string
  headers?: Record<string, string>        // Merged with defaults.headers
  vars?: Record<string, string>           // Available via river.env() alongside process.env
}

function defineConfig(config: VivConfig): VivConfig  // Identity fn for type inference
```

### 4.5 Errors

```typescript
class VivError extends Error {
  constructor(message: string, public code: string) { super(message) }
}

class VivHttpError extends VivError {
  constructor(
    public status: number,
    public statusText: string,
    public url: string,
    public method: string,
    public responseBody: unknown,
    public duration: number,
  ) {
    super(`${method} ${url} → ${status} ${statusText}`, 'HTTP_ERROR')
  }
}

class VivFlowError extends VivError {
  constructor(
    public flowName: string,
    public cause: Error,
  ) {
    super(`Flow "${flowName}" failed: ${cause.message}`, 'FLOW_ERROR')
  }
}

class VivConfigError extends VivError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR')
  }
}
```

---

## 5. Execution Model

### 5.1 Flow Lifecycle

```
river run <flow-name> --env <env>
       │
       ▼
┌─ 1. Config ─────────────────────────────────────────────┐
│  • Find river.config.ts (walk up from cwd)               │
│  • Load via jiti (Node) or native import (Bun)           │
│  • Resolve target environment (--env flag or defaultEnv) │
│  • Load .env → environments/<env>.env → merge            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─ 2. Init ───────────────────────────────────────────────┐
│  • Create MemoryStore (empty)                           │
│  • Create PersistentStore (load .river/state.json)        │
│  • Create HttpClient (baseUrl, default headers, timeout)│
│  • Create FlowCache (empty)                             │
│  • Create Reporter (minimal / verbose / json)           │
│  • Create RiverContext (wires everything together)         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─ 3. Load ───────────────────────────────────────────────┐
│  • Resolve flow file: flowsDir/<flow-name>.ts           │
│  • Dynamic import via jiti (Node) or import() (Bun)     │
│  • Read default export                                  │
│  • Detect type: isFlow() or isDeclarativeFlow()         │
│  • If declarative → wrap into FlowFn                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─ 4. Execute ────────────────────────────────────────────┐
│  • Call flow.execute(context)                           │
│  │                                                      │
│  ├─ On river.get/post/put/delete/patch:                  │
│  │   1. Resolve URL (baseUrl + path, or full URL)       │
│  │   2. Merge headers: config → env → session → request │
│  │   3. Start timer                                     │
│  │   4. fetch()                                         │
│  │   5. Parse response (JSON or text)                   │
│  │   6. Stop timer, calculate size                      │
│  │   7. Reporter: log step result                       │
│  │   8. If schema → validate, throw on fail             │
│  │   9. If !ok (non-2xx) → throw VivHttpError           │
│  │   10. Return VivResponse<T>                          │
│  │                                                      │
│  ├─ On river.run(otherFlow):                             │
│  │   1. Check FlowCache for otherFlow.name              │
│  │   2. If cached + cache:true → skip, log "(cached)"   │
│  │   3. Else → execute otherFlow.execute(context)       │
│  │   4. Register in FlowCache                           │
│  │                                                      │
│  ├─ On river.store/recall: read/write MemoryStore        │
│  ├─ On river.save/load: read/write PersistentStore       │
│  ├─ On river.setHeader: update session headers           │
│  ├─ On river.env: check env vars + config vars           │
│  ├─ On river.log: forward to Reporter                    │
│  │                                                      │
│  └─ On error: catch → wrap in VivFlowError → rethrow    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─ 5. Cleanup ────────────────────────────────────────────┐
│  • PersistentStore.flush() → write .river/state.json      │
│  • Reporter.summary() → print total steps, duration     │
│  • Exit 0 (success) or exit 1 (error)                   │
└─────────────────────────────────────────────────────────┘
```

### 5.2 URL Resolution

```typescript
function resolveUrl(input: string, baseUrl: string): string {
  // Absolute URL → bypass
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input
  }
  // Relative → prepend baseUrl
  const base = baseUrl.replace(/\/+$/, '')
  const path = input.startsWith('/') ? input : `/${input}`
  return `${base}${path}`
}
```

### 5.3 Header Merge Order (lowest → highest priority)

```
config.defaults.headers        →  Content-Type: application/json
env.headers                    →  x-src: yhn-admin
session headers (setHeader)    →  Authorization: Bearer xxx
request options.headers        →  X-Request-Id: abc123
```

Later values override earlier ones for the same key.

### 5.4 Flow Cache

```typescript
class FlowCache {
  private ran = new Map<string, boolean>()

  shouldSkip(flow: Flow): boolean {
    return flow.options.cache === true && this.ran.has(flow.name)
  }

  mark(flow: Flow): void {
    this.ran.set(flow.name, true)
  }
}
```

### 5.5 Environment Variable Resolution

`river.env('KEY')` checks in order:
1. `process.env.KEY` (from .env and environments/<env>.env)
2. `config.environments[activeEnv].vars.KEY`
3. If neither → throw `VivConfigError('Environment variable "KEY" not found')`

With fallback: `river.env('KEY', 'default')` returns `'default'` instead of throwing.

### 5.6 Flow File Loading (cross-runtime)

```typescript
// core/loader.ts
async function loadFlowFile(filePath: string): Promise<Flow | DeclarativeFlow> {
  let mod: any

  if (typeof Bun !== 'undefined') {
    // Bun: native TS import
    mod = await import(filePath)
  } else {
    // Node: use jiti for TS transpilation
    const { createJiti } = await import('jiti')
    const jiti = createJiti(import.meta.url)
    mod = await jiti.import(filePath)
  }

  const exported = mod.default ?? mod
  if (isFlow(exported)) return exported
  if (isDeclarativeFlow(exported)) return exported
  throw new VivConfigError(`Flow file ${filePath} must export a Flow or DeclarativeFlow as default`)
}
```

---

## 6. CLI Commands

### `river init [name]`

```
$ river init my-api

  ◆ Package manager?
  │ ○ bun
  │ ● pnpm
  │ ○ npm
  │ ○ yarn

  ◆ Default base URL?
  │ http://localhost:3000

  Creating my-api/...
    ✓ river.config.ts
    ✓ flows/health-check.ts
    ✓ environments/dev.env
    ✓ .env.example
    ✓ .gitignore
    ✓ package.json
    ✓ tsconfig.json

  Next:
    cd my-api
    pnpm install
    river run health-check
```

### `river run <flow> [options]`

```
$ river run search-stories --env dev

  river ▸ search-stories (dev)

  ✓ login            201   45ms
  ✓ search-stories   200  234ms   12 records

  2 steps · 279ms · all passed
```

| Flag | Description |
|---|---|
| `--env <name>` | Target environment (default: config defaultEnv) |
| `--verbose` | Show request URLs, headers, response bodies |
| `--json` | NDJSON output (one JSON object per step) |
| `--timeout <ms>` | Override default timeout |
| `--dry-run` | Print what would execute, don't send requests |

### `river list`

```
$ river list

  Flows in ./flows/

  health-check     Health check ping
  login            (no description)
  search-stories   (no description)
  get-story        (no description)
  setup-dev        (no description)

  5 flows
```

Discovery: globs `flowsDir/**/*.ts`, imports each, reads `name` and `description` from the exported Flow/DeclarativeFlow.

---

## 7. Example Flows (Yohanna Search API)

### river.config.ts

```typescript
import { defineConfig } from 'river'

export default defineConfig({
  name: 'yohanna-search',

  environments: {
    local: {
      baseUrl: 'http://localhost:4008',
      headers: { 'x-src': 'yhn-admin' },
    },
    dev: {
      baseUrl: 'https://api.dev.yohanna.org/idxs-service',
      headers: { 'x-src': 'yhn-admin' },
    },
    staging: {
      baseUrl: 'https://staging-api.yohanna.org',
    },
    prod: {
      baseUrl: 'https://api.yohanna.org',
    },
  },

  defaultEnv: 'local',

  defaults: {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
  },
})
```

### flows/health-check.ts

```typescript
import { flow } from 'river'

export default flow('health-check', async (river) => {
  const res = await river.get('/health')
  river.log(`API is ${res.data === 'Ok' ? 'healthy' : 'unhealthy'}`)
})
```

### flows/login.ts

```typescript
import { flow } from 'river'

export default flow({ name: 'login', description: 'Authenticate and set bearer token', cache: true }, async (river) => {
  const res = await river.post<{ token: string }>('/auth/login', {
    email: river.env('AUTH_EMAIL'),
    password: river.env('AUTH_PASSWORD'),
  })

  river.setHeader('Authorization', `Bearer ${res.data.token}`)
  river.store('login.token', res.data.token)
  river.log('Authenticated')
})
```

### flows/search-stories.ts

```typescript
import { flow } from 'river'
import login from './login'

export default flow('search-stories', async (river) => {
  await river.run(login)

  const res = await river.post<{ records: any[]; cursor?: string }>('/search/query', {
    q: 'grace',
    collections: ['faith_stories'],
    limit: 10,
    filters: {
      status: {
        operator: 'and',
        constraints: [{ value: 'published', match_mode: 'equals' }],
      },
    },
  })

  river.store('search.results', res.data.records)
  river.store('search.cursor', res.data.cursor)
  river.log(`Found ${res.data.records.length} stories`)
})
```

### flows/get-story.ts

```typescript
import { flow } from 'river'
import searchStories from './search-stories'

export default flow('get-story', async (river) => {
  await river.run(searchStories)  // runs login (cached) → search

  const results = river.recall<any[]>('search.results')
  if (!results?.length) {
    river.log('No results to fetch')
    return
  }

  const first = results[0]
  const res = await river.get(`/search/faith_stories/${first.id}`)

  river.store('story.detail', res.data)
  river.save('story.lastFetched', { id: first.id, at: new Date().toISOString() })
  river.log(`Fetched: ${res.data.title ?? first.id}`)
})
```

### flows/setup-dev.ts (pipeline)

```typescript
import { flow } from 'river'
import login from './login'
import searchStories from './search-stories'
import getStory from './get-story'

export default flow({ name: 'setup-dev', description: 'Bootstrap dev environment' }, async (river) => {
  await river.run(login)
  await river.run(searchStories)
  await river.run(getStory)

  river.save('setup.lastRun', new Date().toISOString())
  river.log('Dev environment ready')
})
```

### Running it

```
$ river run setup-dev --env dev

  river ▸ setup-dev (dev)

  ✓ login            201   52ms
  ✓ search-stories   200  187ms   10 records
  ✓ get-story        200   34ms

  3 steps · 273ms · all passed
```

---

## 8. Dependencies & Tooling

### Production Dependencies (target: ≤ 5)

| Package | Purpose | Size |
|---|---|---|
| `citty` | CLI framework (subcommands, args, help) | ~5KB |
| `consola` | Pretty console output (colors, icons, boxes) | ~15KB |
| `jiti` | Load .ts files at runtime on Node | ~20KB |
| `dotenv` | Load .env files (Node only — Bun has built-in) | ~5KB |

**fetch**: built-in (Node 18+, Bun). **fs/path**: built-in.

### Dev Dependencies

| Package | Purpose |
|---|---|
| `tsup` | Build & bundle (ESM output + .d.ts) |
| `typescript` | Type checking |
| `vitest` | Testing |

### Why these choices

- **citty** over commander: Lighter, TypeScript-first, by unjs (same team as Nuxt/Nitro). Built for modern Node/Bun.
- **jiti** over tsx: Programmatic API (not just a CLI wrapper). Same unjs ecosystem. Used by Nuxt to load `nuxt.config.ts`.
- **consola** over custom: Battle-tested formatting, supports log levels, integrates with citty. Same ecosystem.
- **tsup** over unbuild: Simpler config for single-package builds. Fast (esbuild under the hood).

---

## 9. Build & Distribution

### package.json

```jsonc
{
  "name": "river",
  "version": "0.1.0",
  "description": "API workflow orchestration CLI for developers",
  "type": "module",
  "bin": {
    "river": "./dist/bin/river.mjs"
  },
  "main": "./dist/index.mjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "types": "./dist/index.d.ts"
    }
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "files": ["dist", "README.md", "LICENSE"]
}
```

### Dual exports

- **SDK** (`import { flow, defineConfig } from 'river'`): used in user's flow files and config
- **CLI** (`npx river run ...`): the `bin` entry

### Build command

```bash
tsup src/index.ts src/bin/river.ts --format esm --dts --clean
```

---

## 10. Implementation Phases

### Phase 1 — Core MVP
> Goal: `river run health-check` works end-to-end

- [ ] Repo init (package.json, tsconfig, tsup config)
- [ ] `src/core/flow.ts` — `flow()` factory, `Flow` type, `isFlow()`
- [ ] `src/http/client.ts` — fetch wrapper with URL resolution, timing, headers
- [ ] `src/http/types.ts` — `VivResponse`, `RequestOptions`
- [ ] `src/state/memory-store.ts` — `store()` / `recall()`
- [ ] `src/config/types.ts` — `VivConfig`, `EnvironmentConfig`
- [ ] `src/config/loader.ts` — load `river.config.ts`
- [ ] `src/config/env-loader.ts` — load `.env` + `environments/<env>.env`
- [ ] `src/core/context.ts` — `RiverContext` wiring everything together
- [ ] `src/core/runner.ts` — `FlowRunner` lifecycle (config → init → load → execute → cleanup)
- [ ] `src/core/loader.ts` — dynamic import (jiti/Bun)
- [ ] `src/core/errors.ts` — error classes
- [ ] `src/cli/commands/run.ts` — `river run <flow>` command
- [ ] `src/cli/index.ts` — CLI entry with citty
- [ ] `src/cli/output/minimal.ts` — default reporter
- [ ] `src/index.ts` — public SDK exports
- [ ] `bin/river.ts` — hashbang entry

### Phase 2 — Init + DX
> Goal: `river init my-project && cd my-project && river run health-check` works

- [ ] `src/init/scaffolder.ts` — project scaffolding logic
- [ ] `src/init/templates/*` — all template files
- [ ] `src/cli/commands/init.ts` — `river init` with prompts
- [ ] `src/cli/commands/list.ts` — `river list`
- [ ] `src/cli/output/verbose.ts` — `--verbose` reporter
- [ ] `src/cli/output/json.ts` — `--json` reporter
- [ ] Error formatting (pretty VivHttpError display)

### Phase 3 — State + Advanced
> Goal: `river.save()` / `river.load()` work, flow caching works

- [ ] `src/state/persistent-store.ts` — JSON file persistence
- [ ] Flow cache implementation
- [ ] Declarative flow support (parse DeclarativeFlow → FlowFn)
- [ ] Optional runtime validation (`schema` in RequestOptions)
- [ ] `--dry-run` flag
- [ ] `river state list/get/clear` commands

### Phase 4 — Polish & Ship
> Goal: `npm publish` ready

- [ ] README.md with getting started guide
- [ ] tsup build config finalized
- [ ] npm publish setup (prepublish script, files field)
- [ ] Example Yohanna flows in a separate `examples/` directory
- [ ] CI (GitHub Actions: lint, typecheck, test, build)

---

## 11. Open Questions (Non-Blocking)

These can be decided during implementation:

1. **Config file name**: `river.config.ts` vs `river.config.ts`? (Leaning `river.config.ts` to match package name)
2. **Step counting**: Should `river.run(otherFlow)` count as one step in the reporter, or should it expand to show the sub-flow's steps?
3. **Declarative flow JSONPath**: Ship `jsonpath-plus` as optional dep, or implement basic dot-path extraction (`$.data.token` → `res.data.token`)?
4. **Max recursion depth**: Should `river.run()` have a depth limit to prevent accidental infinite loops?
