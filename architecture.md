# vivr — Architecture

> API workflow orchestration CLI for developers.
> Define flows as TypeScript functions. Compose them. Run them against any API.

---

## 1. Overview

**vivr** is a CLI tool that lets developers define reusable API workflow flows in TypeScript. Unlike test runners (which assert) or API clients (which are manual), vivr automates multi-step API interactions — login, create resources, chain data, bootstrap environments.

**Mental model**: Each flow is an async function that receives a `vivr` context object. That object gives you HTTP methods, state management, environment variables, and the ability to call other flows. Pipelines are just flows that compose other flows.

```typescript
import { flow } from 'vivr'

export default flow('login', async (vivr) => {
  const res = await vivr.http.post<{ token: string }>('/auth/login', {
    email: vivr.env('EMAIL'),
    password: vivr.env('PASSWORD'),
  })
  vivr.headers.set('Authorization', `Bearer ${res.data.token}`)
  vivr.state.set('login.token', res.data.token)
})
```

```
$ vivr run login --env dev
  ✓ login  201  45ms
  1 step completed in 45ms
```

---

## 2. Project Structure (vivr source code)

```
~/batcave/viv/
├── src/
│   ├── index.ts                 # Public SDK exports: flow, defineConfig, types
│   │
│   ├── cli/
│   │   ├── index.ts             # CLI entry point — parse args, route to commands
│   │   ├── commands/
│   │   │   ├── init.ts          # vivr init [name]
│   │   │   ├── run.ts           # vivr run <flow> [--env] [--verbose]
│   │   │   └── list.ts          # vivr list
│   │   └── output/
│   │       ├── reporter.ts      # Reporter interface
│   │       ├── minimal.ts       # Default: ✓ step-name  status  duration
│   │       ├── verbose.ts       # --verbose: + request/response bodies
│   │       └── json.ts          # --json: machine-readable NDJSON
│   │
│   ├── core/
│   │   ├── flow.ts              # flow() factory, Flow interface, isFlow() guard
│   │   ├── context.ts           # VivContext class — the `vivr` object
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
│   │   ├── persistent-store.ts  # JSON file read/write (.viv/state.json)
│   │   └── types.ts             # StateStore interface
│   │
│   ├── config/
│   │   ├── loader.ts            # Find and import vivr.config.ts
│   │   ├── env-loader.ts        # Load .env + environments/<env>.env
│   │   └── types.ts             # VivConfig, EnvironmentConfig
│   │
│   └── init/
│       ├── scaffolder.ts        # mkdir, write files, install deps
│       └── templates/           # Raw template strings
│           ├── config.ts        # vivr.config.ts template
│           ├── flow.ts          # health-check.ts template
│           ├── env.ts           # .env.example template
│           ├── gitignore.ts     # .gitignore template
│           ├── tsconfig.ts      # tsconfig.json template
│           └── package.ts       # package.json template
│
├── bin/
│   └── vivr.ts                  # #!/usr/bin/env node — entry point
│
├── package.json
├── tsconfig.json
└── README.md
```

### Why this layout
- **`src/index.ts`** — what users import: `import { flow, defineConfig } from 'vivr'`
- **`src/cli/`** — CLI-only code, not imported by flow authors
- **`src/core/`** — runtime engine, used by both CLI and SDK
- **`src/http/`** — isolated HTTP layer, testable independently
- **`src/state/`** — state backends behind an interface (swap JSON for SQLite later)
- **`src/config/`** — config loading isolated from core logic
- **`src/init/`** — scaffolding templates, only used by `vivr init`

---

## 3. Scaffolded Project (after `vivr init`)

```
my-api-project/
├── vivr.config.ts              # Project configuration (environments, defaults)
├── .env                        # Local secrets — gitignored
├── .env.example                # Template for teammates — committed
├── flows/
│   └── health-check.ts         # Working example that hits GET /health
├── environments/
│   ├── dev.env                 # Dev-specific vars (BASE_URL, etc.)
│   ├── staging.env
│   └── prod.env
├── .viv/
│   └── state.json              # Persistent state — gitignored
├── .gitignore
├── package.json                # Has vivr as dependency
└── tsconfig.json               # Configured for flow authoring
```

### Generated vivr.config.ts

```typescript
import { defineConfig } from 'vivr'

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
import { flow } from 'vivr'

export default flow('health-check', async (vivr) => {
  const res = await vivr.get('/health')
  vivr.log(`Status: ${res.status} — ${JSON.stringify(res.data)}`)
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

type FlowFn = (vivr: VivContext) => Promise<void>

interface FlowOptions {
  name: string
  description?: string
  cache?: boolean       // If true, skip re-run when called via vivr.run() in same session
  timeout?: number      // Per-flow timeout in ms (default: 30000)
}

// ── Flow object (returned by flow()) ──

interface Flow {
  readonly name: string
  readonly options: Required<FlowOptions>  // defaults filled in
  readonly execute: FlowFn
  readonly __brand: 'vivr-flow'            // runtime type guard
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

### 4.2 VivContext

This is the `vivr` object passed to every flow function. It's the entire API surface flow authors interact with. Methods are **namespaced** for discoverability and to avoid naming conflicts.

```typescript
interface VivContext {
  // ── HTTP (vivr.http.*) ──
  // Auto-resolves base URL from active environment
  // Pass full URL (https://...) to bypass env resolution
  readonly http: {
    get<T = any>(url: string, options?: RequestOptions): Promise<VivResponse<T>>
    post<T = any>(url: string, body?: unknown, options?: RequestOptions): Promise<VivResponse<T>>
    put<T = any>(url: string, body?: unknown, options?: RequestOptions): Promise<VivResponse<T>>
    delete<T = any>(url: string, options?: RequestOptions): Promise<VivResponse<T>>
    patch<T = any>(url: string, body?: unknown, options?: RequestOptions): Promise<VivResponse<T>>
  }

  // ── Session Headers (vivr.headers.*) ──
  // Set once, applied to ALL subsequent requests in this run
  readonly headers: {
    set(key: string, value: string): void
    remove(key: string): void
  }

  // ── State: In-Memory (vivr.state.*) ──
  // Lives only during the current flow run, dies when run ends
  readonly state: {
    set(key: string, value: unknown): void
    get<T = unknown>(key: string): T | undefined
  }

  // ── State: Persistent (vivr.store.*) ──
  // Written to .viv/state.json, survives across runs
  readonly store: {
    save(key: string, value: unknown): void
    load<T = unknown>(key: string): T | undefined
  }

  // ── Environment (flat — simple accessor) ──
  env(key: string): string                        // Throws if not found
  env(key: string, fallback: string): string       // Returns fallback if not found

  // ── Composition (flat — top-level action) ──
  run(flow: Flow): Promise<void>                   // Execute another flow in this context

  // ── Output (flat — simple action) ──
  log(message: string): void                       // User-facing log line

  // ── Metadata (read-only) ──
  readonly environment: string                     // Active env name ("dev", "staging", etc.)
  readonly flowName: string                        // Currently executing flow's name
}
```

### Namespace rationale

| Namespace | Why | Example |
|---|---|---|
| `vivr.http.*` | Groups all HTTP methods, avoids `.get()` ambiguity with state | `vivr.http.get('/health')` |
| `vivr.headers.*` | Clearly scoped to request headers, not state | `vivr.headers.set('Authorization', token)` |
| `vivr.state.*` | In-memory run state — `.get()` is now unambiguous | `vivr.state.set('login.token', token)` |
| `vivr.store.*` | Persistent disk state — distinct from ephemeral state | `vivr.store.save('lastRun', date)` |
| `vivr.env()` | Flat — single accessor, no sub-methods needed | `vivr.env('API_KEY')` |
| `vivr.run()` | Flat — single action, no sub-methods | `vivr.run(loginFlow)` |
| `vivr.log()` | Flat — single action | `vivr.log('Done')` |

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
  vars?: Record<string, string>           // Available via vivr.env() alongside process.env
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
vivr run <flow-name> --env <env>
       │
       ▼
┌─ 1. Config ─────────────────────────────────────────────┐
│  • Find vivr.config.ts (walk up from cwd)               │
│  • Load via jiti (Node) or native import (Bun)           │
│  • Resolve target environment (--env flag or defaultEnv) │
│  • Load .env → environments/<env>.env → merge            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─ 2. Init ───────────────────────────────────────────────┐
│  • Create MemoryStore (empty)                           │
│  • Create PersistentStore (load .viv/state.json)        │
│  • Create HttpClient (baseUrl, default headers, timeout)│
│  • Create FlowCache (empty)                             │
│  • Create Reporter (minimal / verbose / json)           │
│  • Create VivContext (wires everything together)         │
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
│  ├─ On vivr.get/post/put/delete/patch:                  │
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
│  ├─ On vivr.run(otherFlow):                             │
│  │   1. Check FlowCache for otherFlow.name              │
│  │   2. If cached + cache:true → skip, log "(cached)"   │
│  │   3. Else → execute otherFlow.execute(context)       │
│  │   4. Register in FlowCache                           │
│  │                                                      │
│  ├─ On vivr.store/recall: read/write MemoryStore        │
│  ├─ On vivr.save/load: read/write PersistentStore       │
│  ├─ On vivr.setHeader: update session headers           │
│  ├─ On vivr.env: check env vars + config vars           │
│  ├─ On vivr.log: forward to Reporter                    │
│  │                                                      │
│  └─ On error: catch → wrap in VivFlowError → rethrow    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─ 5. Cleanup ────────────────────────────────────────────┐
│  • PersistentStore.flush() → write .viv/state.json      │
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

`vivr.env('KEY')` checks in order:
1. `process.env.KEY` (from .env and environments/<env>.env)
2. `config.environments[activeEnv].vars.KEY`
3. If neither → throw `VivConfigError('Environment variable "KEY" not found')`

With fallback: `vivr.env('KEY', 'default')` returns `'default'` instead of throwing.

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

### `vivr init [name]`

```
$ vivr init my-api

  ◆ Package manager?
  │ ○ bun
  │ ● pnpm
  │ ○ npm
  │ ○ yarn

  ◆ Default base URL?
  │ http://localhost:3000

  Creating my-api/...
    ✓ vivr.config.ts
    ✓ flows/health-check.ts
    ✓ environments/dev.env
    ✓ .env.example
    ✓ .gitignore
    ✓ package.json
    ✓ tsconfig.json

  Next:
    cd my-api
    pnpm install
    vivr run health-check
```

### `vivr run <flow> [options]`

```
$ vivr run search-stories --env dev

  vivr ▸ search-stories (dev)

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

### `vivr list`

```
$ vivr list

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

### vivr.config.ts

```typescript
import { defineConfig } from 'vivr'

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
import { flow } from 'vivr'

export default flow('health-check', async (vivr) => {
  const res = await vivr.get('/health')
  vivr.log(`API is ${res.data === 'Ok' ? 'healthy' : 'unhealthy'}`)
})
```

### flows/login.ts

```typescript
import { flow } from 'vivr'

export default flow({ name: 'login', description: 'Authenticate and set bearer token', cache: true }, async (vivr) => {
  const res = await vivr.post<{ token: string }>('/auth/login', {
    email: vivr.env('AUTH_EMAIL'),
    password: vivr.env('AUTH_PASSWORD'),
  })

  vivr.setHeader('Authorization', `Bearer ${res.data.token}`)
  vivr.store('login.token', res.data.token)
  vivr.log('Authenticated')
})
```

### flows/search-stories.ts

```typescript
import { flow } from 'vivr'
import login from './login'

export default flow('search-stories', async (vivr) => {
  await vivr.run(login)

  const res = await vivr.post<{ records: any[]; cursor?: string }>('/search/query', {
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

  vivr.store('search.results', res.data.records)
  vivr.store('search.cursor', res.data.cursor)
  vivr.log(`Found ${res.data.records.length} stories`)
})
```

### flows/get-story.ts

```typescript
import { flow } from 'vivr'
import searchStories from './search-stories'

export default flow('get-story', async (vivr) => {
  await vivr.run(searchStories)  // runs login (cached) → search

  const results = vivr.recall<any[]>('search.results')
  if (!results?.length) {
    vivr.log('No results to fetch')
    return
  }

  const first = results[0]
  const res = await vivr.get(`/search/faith_stories/${first.id}`)

  vivr.store('story.detail', res.data)
  vivr.save('story.lastFetched', { id: first.id, at: new Date().toISOString() })
  vivr.log(`Fetched: ${res.data.title ?? first.id}`)
})
```

### flows/setup-dev.ts (pipeline)

```typescript
import { flow } from 'vivr'
import login from './login'
import searchStories from './search-stories'
import getStory from './get-story'

export default flow({ name: 'setup-dev', description: 'Bootstrap dev environment' }, async (vivr) => {
  await vivr.run(login)
  await vivr.run(searchStories)
  await vivr.run(getStory)

  vivr.save('setup.lastRun', new Date().toISOString())
  vivr.log('Dev environment ready')
})
```

### Running it

```
$ vivr run setup-dev --env dev

  vivr ▸ setup-dev (dev)

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
  "name": "vivr",
  "version": "0.1.0",
  "description": "API workflow orchestration CLI for developers",
  "type": "module",
  "bin": {
    "vivr": "./dist/bin/vivr.mjs"
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

- **SDK** (`import { flow, defineConfig } from 'vivr'`): used in user's flow files and config
- **CLI** (`npx vivr run ...`): the `bin` entry

### Build command

```bash
tsup src/index.ts src/bin/vivr.ts --format esm --dts --clean
```

---

## 10. Implementation Phases

### Phase 1 — Core MVP
> Goal: `vivr run health-check` works end-to-end

| # | Task | QA: Command | QA: Pass Criteria |
|---|------|-------------|-------------------|
| 1 | Repo init (package.json, tsconfig, tsup config) | `tsc --noEmit` | Exit 0, no errors |
| 2 | `src/core/flow.ts` — `flow()` factory, `Flow` type, `isFlow()` | `vitest run src/core/flow.test.ts` | `flow('test', fn)` returns `Flow` with `__brand: 'vivr-flow'`; `isFlow()` returns true for flows, false for plain objects |
| 3 | `src/http/types.ts` — `VivResponse`, `RequestOptions` | `tsc --noEmit` | Types compile, no errors |
| 4 | `src/http/client.ts` — fetch wrapper with URL resolution, timing, headers | `vitest run src/http/client.test.ts` | (a) Relative URL `/foo` + baseUrl `http://x.com` → `http://x.com/foo`; (b) Absolute URL `https://y.com/bar` bypasses baseUrl; (c) Headers merge in correct order; (d) Non-2xx throws `VivHttpError` with status, url, method; (e) Duration > 0ms |
| 5 | `src/state/memory-store.ts` — `store()` / `recall()` | `vitest run src/state/memory-store.test.ts` | `store('k', 'v')` then `recall('k')` returns `'v'`; `recall('missing')` returns `undefined` |
| 6 | `src/config/types.ts` — `VivConfig`, `EnvironmentConfig` | `tsc --noEmit` | Types compile |
| 7 | `src/config/loader.ts` — load `vivr.config.ts` | `vitest run src/config/loader.test.ts` | Given a temp dir with a `vivr.config.ts`, loader returns parsed `VivConfig` object with correct `environments` |
| 8 | `src/config/env-loader.ts` — load `.env` + `environments/<env>.env` | `vitest run src/config/env-loader.test.ts` | Given `.env` with `A=1` and `environments/dev.env` with `B=2`, loading `dev` env yields both `A` and `B` in `process.env` |
| 9 | `src/core/errors.ts` — error classes | `tsc --noEmit` | All error classes extend `VivError`, `VivHttpError` has `status`, `url`, `method` properties |
| 10 | `src/core/context.ts` — `VivContext` wiring everything together | `vitest run src/core/context.test.ts` | Context exposes all methods: get/post/put/delete/patch, store/recall, env, setHeader/removeHeader, log, run. Each delegates to the correct underlying module. |
| 11 | `src/core/loader.ts` — dynamic import (jiti/Bun) | `vitest run src/core/loader.test.ts` | Given a `.ts` file exporting `flow('test', fn)`, loader returns the `Flow` object. Given a non-flow export, throws `VivConfigError`. |
| 12 | `src/core/runner.ts` — `FlowRunner` lifecycle | `vitest run src/core/runner.test.ts` | (a) Runs a flow that calls `vivr.store()` — value retrievable after; (b) Runner catches errors and wraps in `VivFlowError`; (c) Runner calls reporter for each HTTP step |
| 13 | `src/cli/output/reporter.ts` + `minimal.ts` — default reporter | `vitest run src/cli/output/minimal.test.ts` | Reporter receives step events, `minimal` formats as `✓ name  status  duration` string |
| 14 | `src/cli/commands/run.ts` — `vivr run <flow>` command | Manual: `bun run bin/vivr.ts run health-check --env dev` | Exits 0, prints minimal output with ✓ step line and summary |
| 15 | `src/cli/index.ts` — CLI entry with citty | `bun run bin/vivr.ts --help` | Prints help with `run` subcommand listed |
| 16 | `src/index.ts` — public SDK exports | `tsc --noEmit` | Exports: `flow`, `defineConfig`, `Flow`, `VivContext`, `VivResponse`, `VivConfig` |
| 17 | `bin/vivr.ts` — hashbang entry | `node dist/bin/vivr.mjs --help` AND `bun run bin/vivr.ts --help` | Both print help text, exit 0 |

**Phase 1 gate**: Create a temp project with `vivr.config.ts` pointing to `https://httpbin.org`, a `flows/health-check.ts` that does `vivr.get('/get')`, and run `vivr run health-check`. Must print `✓ health-check  200  <duration>` and exit 0.

---

### Phase 2 — Init + DX
> Goal: `vivr init my-project && cd my-project && vivr run health-check` works

| # | Task | QA: Command | QA: Pass Criteria |
|---|------|-------------|-------------------|
| 1 | `src/init/templates/*` — all template files | `tsc --noEmit` | Templates compile as valid TS string literals |
| 2 | `src/init/scaffolder.ts` — project scaffolding logic | `vitest run src/init/scaffolder.test.ts` | Given a temp dir, scaffolder creates: `vivr.config.ts`, `flows/health-check.ts`, `environments/dev.env`, `.env.example`, `.gitignore`, `package.json`, `tsconfig.json`. All files exist and are non-empty. |
| 3 | `src/cli/commands/init.ts` — `vivr init` with prompts | Manual: `bun run bin/vivr.ts init test-project` | Prompts for package manager + base URL, creates directory with all expected files |
| 4 | `src/cli/commands/list.ts` — `vivr list` | Manual: run in scaffolded project | Lists `health-check` flow with name. Exit 0. |
| 5 | `src/cli/output/verbose.ts` — `--verbose` reporter | Manual: `vivr run health-check --verbose` | Shows request URL, method, headers, response body in addition to status line |
| 6 | `src/cli/output/json.ts` — `--json` reporter | `vivr run health-check --json \| jq .` | Each line is valid JSON with keys: `flow`, `step`, `status`, `duration`, `url`, `method` |
| 7 | Error formatting (pretty VivHttpError display) | Manual: create flow that hits a 404 | Prints formatted error: red step line, URL, status, response body excerpt. Exits 1. |

**Phase 2 gate**: Run `vivr init test-proj`, `cd test-proj`, install deps, `vivr run health-check`. Must print `✓ health-check  200  <duration>` and exit 0. Then `vivr list` shows `health-check`.

---

### Phase 3 — State + Advanced
> Goal: `vivr.save()` / `vivr.load()` work, flow caching works

| # | Task | QA: Command | QA: Pass Criteria |
|---|------|-------------|-------------------|
| 1 | `src/state/persistent-store.ts` — JSON file persistence | `vitest run src/state/persistent-store.test.ts` | (a) `save('k', 'v')` then `flush()` writes to `.viv/state.json`; (b) New `PersistentStore` instance `load('k')` returns `'v'`; (c) File is valid JSON |
| 2 | Flow cache implementation | `vitest run src/core/runner.test.ts` (cache tests) | Flow with `cache: true` called twice via `vivr.run()` — executes once, second call skips. Flow with `cache: false` called twice — executes both times. |
| 3 | Declarative flow support | `vitest run src/core/flow.test.ts` (declarative tests) | `{ name: 'test', steps: [{ method: 'GET', url: '/foo' }] }` is detected by `isDeclarativeFlow()`, wrapped to a `FlowFn`, and executing it calls `vivr.get('/foo')` |
| 4 | Optional runtime validation (`schema` in RequestOptions) | `vitest run src/http/client.test.ts` (schema tests) | (a) With matching Zod schema — returns typed data; (b) With non-matching schema — throws validation error |
| 5 | `--dry-run` flag | Manual: `vivr run login --dry-run` | Prints steps that would execute (method, URL, body) but sends NO HTTP requests. Exit 0. |
| 6 | `vivr state list/get/clear` commands | Manual: run flow that `save()`s, then `vivr state list` | `list` shows all keys. `get login.token` shows value. `clear` empties `.viv/state.json`. |

**Phase 3 gate**: Run flow that calls `vivr.save('test.key', 123)`. Check `.viv/state.json` contains `{"test.key": 123}`. New run with `vivr.load('test.key')` returns `123`.

---

### Phase 4 — Polish & Ship
> Goal: `npm publish` ready

| # | Task | QA: Command | QA: Pass Criteria |
|---|------|-------------|-------------------|
| 1 | README.md with getting started guide | Manual review | Has: install, init, write first flow, run, env setup sections. All commands are copy-pasteable. |
| 2 | tsup build config finalized | `tsup && ls dist/` | `dist/` contains `index.mjs`, `index.d.ts`, `bin/vivr.mjs`. No errors. |
| 3 | npm publish setup | `npm pack --dry-run` | Package includes: `dist/`, `README.md`. Excludes: `src/`, `node_modules/`, tests. Size < 100KB. |
| 4 | Example Yohanna flows | `ls examples/yohanna-search/flows/` | Contains: `health-check.ts`, `login.ts`, `search-stories.ts`, `get-story.ts`, `setup-dev.ts` |
| 5 | CI (GitHub Actions) | Push to repo, check Actions tab | Runs: `tsc --noEmit`, `vitest run`, `tsup`. All green. |

**Phase 4 gate**: `npm pack`, install from tarball in a fresh directory, `npx vivr init test && cd test && npm install && npx vivr run health-check` works end-to-end.

---

## 11. Open Questions (Non-Blocking)

These can be decided during implementation:

1. **Config file name**: `vivr.config.ts` vs `viv.config.ts`? (Leaning `vivr.config.ts` to match package name)
2. **Step counting**: Should `vivr.run(otherFlow)` count as one step in the reporter, or should it expand to show the sub-flow's steps?
3. **Declarative flow JSONPath**: Ship `jsonpath-plus` as optional dep, or implement basic dot-path extraction (`$.data.token` → `res.data.token`)?
4. **Max recursion depth**: Should `vivr.run()` have a depth limit to prevent accidental infinite loops?
