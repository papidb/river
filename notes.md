# Notes: river Research

## Source 1: Existing E2E Runner (~/batcave/e2e-runner)

### Architecture
- Bun/TypeScript, zero external deps, ~1500 LOC
- Sequential test runner for Yohanna search API
- Clean separation: core/ (types, http, runner), config/ (envs, test-cases), output/ (console, markdown), validators/, utils/

### Reusable Patterns
- **HttpClient**: fetch wrapper with bearer auth, env-based URLs — good reference for river's HTTP client
- **Environment config**: multi-env (local/dev/staging/prod) with baseUrl + defaultHeaders — maps directly to river's env model
- **OutputAdapter**: abstract base class with console + markdown implementations — strategy pattern for river's output
- **PerformanceTracker**: timing per operation — reuse for step duration tracking

### Key Gap
- **No data passing between steps** — each test is self-contained, responses validated then discarded
- This is the entire delta between "test runner" and "workflow orchestrator"

---

## Source 2: Yohanna idxs-service (~/batcave/yohanna/idxs-service)

### Framework & Stack
- **Framework**: Elysia (NOT NestJS)
- **Runtime**: Bun
- **Port**: 4008
- **Backend**: OpenSearch

### API Endpoints (2 total)
1. **POST /search/query** — full-text search with filters, pagination
   - Request: `{ q?, collections?, limit?, cursor?, order?, filters? }`
   - Response: `{ records: [...], cursor?, total? }`
2. **GET /search/:collection/:id** — get document by ID
   - Response: `{ id, _index?, ...fields }`

### Auth
- JWT Bearer token (RS256)
- Public key verification via AUTH_PUBLIC_KEY env var
- Uses `@yohanna-foundation/yhn-common` package

### Collections
- faith_stories, series_info, bible_verses, series_episodes

### Chaining Opportunities (first river use case)
- Search → extract IDs → Get by ID
- Login → set auth header → Search → paginate with cursor

---

## Source 3: Similar Tools (External Research)

### Step CI (closest match)
- YAML workflows, captures (JSONPath), variable interpolation `${{captures.token}}`
- Usable as library: `import { runFromFile } from '@stepci/runner'`
- BUT: testing-focused, not developer-productivity-focused

### Bruno (42k stars)
- `bru.runRequest()` for chaining, `bru.setVar()`/`bru.getVar()` for state
- Scriptable with JS between requests
- BUT: full GUI app, not embeddable CLI

### OpenWorkflow (1.2k stars)
- TypeScript-native `step.run()` with value passing, durable/resumable
- Supports Bun
- BUT: designed for backend workflows, not API interaction flows

### Serverless Workflow Spec (CNCF)
- Vendor-neutral YAML/JSON DSL, HTTP/gRPC/events
- TypeScript SDK available
- BUT: way too heavy for this use case

### Verdict
Nothing does exactly what river aims to do. Step CI is closest but assertion-oriented. Custom build justified.

---

## Source 4: CLI Init Scaffolding Patterns

### Best Patterns Found

| Tool | Config Format | Key Files |
|------|--------------|-----------|
| Prisma | Custom DSL (.prisma) | prisma/schema.prisma |
| Next.js | JS/TS (next.config.js) | src/app/, .env.local |
| Wrangler | TOML (wrangler.toml) | src/index.ts |
| Bruno | YAML-like (.bru) | collection.bru, environments/ |
| Step CI | YAML | tests/workflow.yml |

### Environment Handling Best Practices
- **Per-env files**: Bruno pattern — environments/dev.bru, environments/staging.bru
- **Inheritance**: Wrangler pattern — top-level defaults, env-specific overrides
- **.env for secrets**: Universal pattern — .env.local gitignored, .env.example committed
- **CLI flag selection**: `--env staging` to switch

### Principles for river init
1. Minimal by default — only essential files
2. Git-friendly — YAML/TS config, .gitignore included
3. Working example — health check flow that runs immediately
4. Onboarding — .env.example + README for teammates
5. Type safety — river.config.ts with defineConfig()

---

## Variable Interpolation Patterns (for reference)

| Tool | Syntax | Scope |
|------|--------|-------|
| Step CI | `${{env.var}}`, `${{captures.token}}` | Environment + Captures |
| Bruno | `{{variable}}` | Collection/Environment |
| Serverless Workflow | `${ .path }` | JSON path expressions |

river uses TypeScript, so no template syntax needed — just `river.recall('key')` and `river.env('KEY')`.

---

## API Design Naming (Resolved)

### Conflict: `river.get()` for HTTP GET vs state retrieval
**Resolution**:
- HTTP: `river.get()`, `river.post()`, `river.put()`, `river.delete()`, `river.patch()`
- In-memory state: `river.store(key, val)` / `river.recall(key)`
- Persistent state: `river.save(key, val)` / `river.load(key)`
- Headers: `river.setHeader(k, v)` / `river.removeHeader(k)`
- Environment: `river.env(key)` / `river.env(key, fallback)`
- Composition: `river.run(flow)`
- Logging: `river.log(message)`
- Metadata: `river.environment` (readonly), `river.flowName` (readonly)

No naming conflicts. Clean API.

---

## Source 5: Tooling Decisions (Resolved)

### CLI Framework → citty
- By unjs (same team as Nuxt/Nitro)
- Lightweight (~5KB), TypeScript-first, subcommand support
- Works on both Bun and Node
- Used by nuxi (Nuxt CLI)

### TS Runtime Loader → jiti
- By unjs, loads .ts files at runtime via programmatic API
- On Node: jiti transpiles and imports
- On Bun: skip jiti, use native `import()` (Bun handles .ts natively)
- Used by Nuxt to load nuxt.config.ts

### npm Name → river
- `river` was rejected by npm as too similar
- `river` is available on npm
- CLI command: `river`

### Build → tsup
- esbuild under the hood, fast
- ESM output + .d.ts generation
- Simple config for single-package builds
