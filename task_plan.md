# Task Plan: Build river — API Workflow Orchestration CLI

## Goal
Design and build "river", a TypeScript CLI tool that lets developers define, compose, and run API workflow flows against any API. Ship an MVP with public example flows that anyone can run as proof of concept.

## Phases
- [x] Phase 1: Requirements gathering — clarify concept with user
- [x] Phase 2: Research — explore existing tools, patterns, and the target API
- [x] Phase 3: Architecture design — types, modules, execution model, folder structure  ✅ Momus approved
- [x] Phase 4: Core implementation — flow(), RiverContext, FlowRunner, HTTP client  ✅ Gate passed
- [x] Phase 5: CLI implementation — river run command  ✅ (init/list/state in Phase 2 of arch)
- [x] Phase 6: Init scaffolding — templates, project generation  ✅ Verified end-to-end
- [x] Phase 7: Example flows — public JSONPlaceholder examples  ✅ Verified end-to-end
- [x] Phase 8: Polish — error handling, output formatting, docs  ✅ Verified
- [x] Phase 9: Build & publish setup — package build, tarball verification, fresh install verification  ✅ Verified

## Key Decisions (Locked)

### Identity
- **Name**: river (npm: `@papidb/river`, CLI command: `river`)
- **Audience**: Developers / tech people
- **Runtime**: Bun + Node.js (both from start)
- **Distribution**: npm (`npx @papidb/river init`)
- **Package arch**: Single package (split later)
- **Location**: ~/batcave/river

### Flow Authoring
- **Format**: TypeScript imperative `async (river) => {}` primary, declarative object as fallback
- **Dependencies**: Explicit TS imports between flow files
- **Dep caching**: Configurable per-flow (`cache: true/false`)
- **Pipelines**: Just flows that import/call other flows — no separate concept

### HTTP
- **Abstraction**: Full — `river.post()`, `river.get()`, etc. (user never writes fetch)
- **URL resolution**: Auto-resolve from active env baseUrl, pass full URL to bypass
- **Response typing**: Generics `river.post<T>()` + optional runtime validation (Zod/Typebox)
- **Auth**: Just a flow step — not built-in strategies

### State
- **In-run**: `river.store(key, value)` / `river.recall(key)` — lives only during flow execution
- **Persistent**: `river.save(key, value)` / `river.load(key)` — JSON file on disk (.river/state.json)
- **Scoping**: Namespaced by convention (flat store, keys like `login.token`)

### DX
- **Error handling**: Stop flow + show error by default (users can try/catch)
- **Output**: Minimal by default (step status only), --verbose for detail
- **Environments**: .env files (secrets) + config sections (URLs/settings)
- **Init template**: Working example (health check flow)
- **Package manager**: Ask during `river init`
- **Project structure**: Structured folders (flows/, environments/, .river/)

## Key Questions (Resolved in Phase 3)
1. ~~CLI framework~~ → **citty** (by unjs, lightweight, TS-first, subcommands, Bun+Node)
2. ~~TS runtime execution~~ → **jiti** (by unjs) on Node, native `import()` on Bun
3. ~~Async config~~ → **No** for v1. `defineConfig` returns plain object.
4. ~~Flow discovery~~ → Glob `*.ts` in `flowsDir` (default: `./flows`). Name = filename.
5. ~~MVP commands~~ → `river run`, `river init`, `river list`. State commands in Phase 2.
6. ~~npm name~~ → `@papidb/river` (scoped public package). CLI command: `river`.

## Errors Encountered
- `tsup` DTS build tripped over a TypeScript 6 deprecation (`baseUrl`) despite `tsc --noEmit` being clean. Resolved by splitting JS bundling (`tsup`) from declaration generation (`tsc -p tsconfig.build.json`).
- Local scaffold verification initially failed because the generated project depended on a local `file:` package before `dist/` existed. Resolved by making `river init --local` build the current package first.

## Status
**Phases 6, 8, and 9 complete** — `river` now builds, packs, installs, scaffolds, and runs successfully from a real tarball. Verification passed across `pnpm build`, `npm pack --dry-run`, fresh consumer install, packaged CLI execution, scaffolded-project run, `tsc --noEmit`, LSP diagnostics, success examples, and failure examples. Next sensible step is `river list`, persistent store, or verbose/JSON output.
