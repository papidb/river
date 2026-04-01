import type { Reporter } from '../cli/output/reporter.js'
import { RiverConfigError } from './errors.js'
import type { EmptyInput, Flow } from './flow.js'
import type { HttpClient } from '../http/client.js'
import type { RequestOptions, RiverResponse } from '../http/types.js'
import type { StateStore } from '../state/types.js'

class FlowCache {
  readonly #results = new Map<string, unknown>()

  has(key: string): boolean {
    return this.#results.has(key)
  }

  get<Output>(key: string): Output | undefined {
    return this.#results.get(key) as Output | undefined
  }

  set(key: string, value: unknown): void {
    this.#results.set(key, value)
  }
}

function stableSerialize(value: unknown): string {
  if (value === undefined) {
    return '__undefined__'
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`).join(',')}}`
}

function getCacheKey(flowName: string, input: unknown): string {
  return `${flowName}::${stableSerialize(input)}`
}

export interface RiverContext {
  readonly http: {
    get<T = unknown>(url: string, options?: RequestOptions): Promise<RiverResponse<T>>
    post<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<RiverResponse<T>>
    put<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<RiverResponse<T>>
    delete<T = unknown>(url: string, options?: RequestOptions): Promise<RiverResponse<T>>
    patch<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<RiverResponse<T>>
  }
  readonly headers: {
    set(key: string, value: string): void
    remove(key: string): void
  }
  readonly state: {
    set(key: string, value: unknown): void
    get<T = unknown>(key: string): T | undefined
  }
  readonly store: {
    save(key: string, value: unknown): void
    load<T = unknown>(key: string): T | undefined
  }
  env(key: string): string
  env(key: string, fallback: string): string
  run(flow: Flow): Promise<void>
  run<Input extends object, Output>(flow: Flow<Input, Output>, input: Input): Promise<Output>
  log(message: string): void
  readonly environment: string
  readonly flowName: string
}

interface RiverContextOptions {
  environment: string
  flowNameRef: { name: string }
  httpClient: HttpClient
  stateStore: StateStore
  persistentStore: StateStore
  envVars: Record<string, string>
  sessionHeaders: Record<string, string>
  reporter: Reporter
}

function withTimeout<T>(task: Promise<T>, timeoutMs: number, flowName: string): Promise<T> {
  if (timeoutMs <= 0) {
    return task
  }

  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => {
      reject(new RiverConfigError(`Flow "${flowName}" timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    task
      .then((value) => resolve(value))
      .catch((error: unknown) => reject(error))
      .finally(() => {
        clearTimeout(id)
      })
  })
}

export class RiverContextImpl implements RiverContext {
  readonly #environment: string
  readonly #flowNameRef: { name: string }
  readonly #httpClient: HttpClient
  readonly #stateStore: StateStore
  readonly #persistentStore: StateStore
  readonly #envVars: Record<string, string>
  readonly #sessionHeaders: Record<string, string>
  readonly #reporter: Reporter
  readonly #flowCache = new FlowCache()

  readonly http
  readonly headers
  readonly state
  readonly store

  constructor(options: RiverContextOptions) {
    this.#environment = options.environment
    this.#flowNameRef = options.flowNameRef
    this.#httpClient = options.httpClient
    this.#stateStore = options.stateStore
    this.#persistentStore = options.persistentStore
    this.#envVars = options.envVars
    this.#sessionHeaders = options.sessionHeaders
    this.#reporter = options.reporter

    this.http = {
      get: <T = unknown>(url: string, requestOptions?: RequestOptions) => this.#httpClient.get<T>(url, requestOptions),
      post: <T = unknown>(url: string, body?: unknown, requestOptions?: RequestOptions) =>
        this.#httpClient.post<T>(url, body, requestOptions),
      put: <T = unknown>(url: string, body?: unknown, requestOptions?: RequestOptions) =>
        this.#httpClient.put<T>(url, body, requestOptions),
      delete: <T = unknown>(url: string, requestOptions?: RequestOptions) => this.#httpClient.delete<T>(url, requestOptions),
      patch: <T = unknown>(url: string, body?: unknown, requestOptions?: RequestOptions) =>
        this.#httpClient.patch<T>(url, body, requestOptions),
    }

    this.headers = {
      set: (key: string, value: string) => {
        this.#sessionHeaders[key] = value
      },
      remove: (key: string) => {
        delete this.#sessionHeaders[key]
      },
    }

    this.state = {
      set: (key: string, value: unknown) => {
        this.#stateStore.set(key, value)
      },
      get: <T = unknown>(key: string) => this.#stateStore.get<T>(key),
    }

    this.store = {
      save: (key: string, value: unknown) => {
        this.#persistentStore.set(key, value)
      },
      load: <T = unknown>(key: string) => this.#persistentStore.get<T>(key),
    }
  }

  get environment(): string {
    return this.#environment
  }

  get flowName(): string {
    return this.#flowNameRef.name
  }

  env(key: string): string
  env(key: string, fallback: string): string
  env(key: string, fallback?: string): string {
    const processValue = process.env[key]
    if (typeof processValue === 'string') {
      return processValue
    }

    const configValue = this.#envVars[key]
    if (typeof configValue === 'string') {
      return configValue
    }

    if (typeof fallback === 'string') {
      return fallback
    }

    throw new RiverConfigError(`Environment variable "${key}" not found`)
  }

  async run(flow: Flow): Promise<void>
  async run<Input extends object, Output>(flow: Flow<Input, Output>, input: Input): Promise<Output>
  async run<Input extends object, Output>(flow: Flow<Input, Output>, input?: Input): Promise<Output | void> {
    const normalizedInput = (input ?? ({} as EmptyInput)) as Input
    const cacheKey = getCacheKey(flow.name, normalizedInput)

    if (flow.options.cache === true && this.#flowCache.has(cacheKey)) {
      this.#reporter.onLog(`↷ ${flow.name} (cached)`)
      return this.#flowCache.get<Output>(cacheKey)
    }

    const previousFlowName = this.#flowNameRef.name
    this.#flowNameRef.name = flow.name

    try {
      const output = await withTimeout(Promise.resolve(flow.execute(this, normalizedInput)), flow.options.timeout, flow.name)
      if (flow.options.cache === true) {
        this.#flowCache.set(cacheKey, output)
      }
      return output
    } finally {
      this.#flowNameRef.name = previousFlowName
    }
  }

  log(message: string): void {
    this.#reporter.onLog(message)
  }
}

export { FlowCache }
