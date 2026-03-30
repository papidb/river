import type { RiverContext } from './context.js'

export type FlowFn = (river: RiverContext) => Promise<void>

export interface FlowOptions {
  name: string
  description?: string
  cache?: boolean
  timeout?: number
}

export interface Flow {
  readonly name: string
  readonly options: Required<FlowOptions>
  readonly execute: FlowFn
  readonly __brand: 'river-flow'
}

export interface DeclarativeStep {
  name?: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  headers?: Record<string, string>
  body?: unknown
  extract?: Record<string, string>
}

export interface DeclarativeFlow {
  name: string
  description?: string
  cache?: boolean
  steps: DeclarativeStep[]
}

const DEFAULT_TIMEOUT = 30_000

export function flow(name: string, fn: FlowFn): Flow
export function flow(options: FlowOptions, fn: FlowFn): Flow
export function flow(nameOrOptions: string | FlowOptions, fn: FlowFn): Flow {
  const options: Required<FlowOptions> =
    typeof nameOrOptions === 'string'
      ? {
          name: nameOrOptions,
          description: '',
          cache: false,
          timeout: DEFAULT_TIMEOUT,
        }
      : {
          name: nameOrOptions.name,
          description: nameOrOptions.description ?? '',
          cache: nameOrOptions.cache ?? false,
          timeout: nameOrOptions.timeout ?? DEFAULT_TIMEOUT,
        }

  return {
    name: options.name,
    options,
    execute: fn,
    __brand: 'river-flow',
  }
}

export function isFlow(value: unknown): value is Flow {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<Flow>
  return (
    candidate.__brand === 'river-flow' &&
    typeof candidate.name === 'string' &&
    typeof candidate.execute === 'function' &&
    typeof candidate.options === 'object' &&
    candidate.options !== null
  )
}

export function isDeclarativeFlow(value: unknown): value is DeclarativeFlow {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<DeclarativeFlow>
  return (
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.steps) &&
    candidate.steps.every((step) => {
      if (!step || typeof step !== 'object') {
        return false
      }

      const typedStep = step as Partial<DeclarativeStep>
      const validMethod =
        typedStep.method === 'GET' ||
        typedStep.method === 'POST' ||
        typedStep.method === 'PUT' ||
        typedStep.method === 'DELETE' ||
        typedStep.method === 'PATCH'

      return validMethod && typeof typedStep.url === 'string'
    })
  )
}
