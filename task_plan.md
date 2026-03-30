# Task Plan: Build viv — API Workflow Orchestration CLI

## Goal
Design and build "vivr", a TypeScript CLI tool that lets developers define, compose, and run API workflow flows against any API. Ship an MVP with public example flows that anyone can run as proof of concept.

## Phases
- [x] Phase 1: Requirements gathering — clarify concept with user
- [x] Phase 2: Research — explore existing tools, patterns, and the target API
- [x] Phase 3: Architecture design — types, modules, execution model, folder structure  ✅ Momus approved
- [x] Phase 4: Core implementation — flow(), VivContext, FlowRunner, HTTP client  ✅ Gate passed
- [x] Phase 5: CLI implementation — vivr run command  ✅ (init/list/state in Phase 2 of arch)
- [x] Phase 6: Init scaffolding — templates, project generation  ✅ Verified end-to-end
- [x] Phase 7: Example flows — public JSONPlaceholder examples  ✅ Verified end-to-end
- [x] Phase 8: Polish — error handling, output formatting, docs  ✅ Verified
- [x] Phase 9: Build & publish setup — package build, tarball verification, fresh install verification  ✅ Verified

## Key Decisions (Locked)

### Identity
- **Name**: vivr (npm: `vivr`, CLI command: `vivr`)
- **Audience**: Developers / tech people
- **Runtime**: Bun + Node.js (both from start)
- **Distribution**: npm (`npx vivr init`)
- **Package arch**: Single package (split later)
- **Location**: ~/batcave/viv

### Flow Authoring
- **Format**: TypeScript imperative `async (viv) => {}` primary, declarative object as fallback
- **Dependencies**: Explicit TS imports between flow files
- **Dep caching**: Configurable per-flow (`cache: true/false`)
- **Pipelines**: Just flows that import/call other flows — no separate concept

### HTTP
- **Abstraction**: Full — `viv.post()`, `viv.get()`, etc. (user never writes fetch)
- **URL resolution**: Auto-resolve from active env baseUrl, pass full URL to bypass
- **Response typing**: Generics `viv.post<T>()` + optional runtime validation (Zod/Typebox)
- **Auth**: Just a flow step — not built-in strategies

### State
- **In-run**: `viv.store(key, value)` / `viv.recall(key)` — lives only during flow execution
- **Persistent**: `viv.save(key, value)` / `viv.load(key)` — JSON file on disk (.viv/state.json)
- **Scoping**: Namespaced by convention (flat store, keys like `login.token`)

### DX
- **Error handling**: Stop flow + show error by default (users can try/catch)
- **Output**: Minimal by default (step status only), --verbose for detail
- **Environments**: .env files (secrets) + config sections (URLs/settings)
- **Init template**: Working example (health check flow)
- **Package manager**: Ask during `viv init`
- **Project structure**: Structured folders (flows/, environments/, .viv/)

## Key Questions (Resolved in Phase 3)
1. ~~CLI framework~~ → **citty** (by unjs, lightweight, TS-first, subcommands, Bun+Node)
2. ~~TS runtime execution~~ → **jiti** (by unjs) on Node, native `import()` on Bun
3. ~~Async config~~ → **No** for v1. `defineConfig` returns plain object.
4. ~~Flow discovery~~ → Glob `*.ts` in `flowsDir` (default: `./flows`). Name = filename.
5. ~~MVP commands~~ → `vivr run`, `vivr init`, `vivr list`. State commands in Phase 2.
6. ~~npm name~~ → `vivr` (available). CLI command: `vivr`.

## Errors Encountered
- `tsup` DTS build tripped over a TypeScript 6 deprecation (`baseUrl`) despite `tsc --noEmit` being clean. Resolved by splitting JS bundling (`tsup`) from declaration generation (`tsc -p tsconfig.build.json`).
- Local scaffold verification initially failed because the generated project depended on a local `file:` package before `dist/` existed. Resolved by making `vivr init --local` build the current package first.

## Status
**Phases 6, 8, and 9 complete** — `vivr` now builds, packs, installs, scaffolds, and runs successfully from a real tarball. Verification passed across `pnpm build`, `npm pack --dry-run`, fresh consumer install, packaged CLI execution, scaffolded-project run, `tsc --noEmit`, LSP diagnostics, success examples, and failure examples. One non-blocking caution from final review: `prepack` currently depends on `pnpm` being available in the publish environment. Next sensible step is `vivr list`, persistent store, or verbose/JSON output.
