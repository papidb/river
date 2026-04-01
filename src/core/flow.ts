import type { RiverContext } from './context.js'

export type EmptyInput = Record<string, never>

export type FlowFn<Input extends object = EmptyInput, Output = void> =
  (river: RiverContext, input: Input) => Promise<Output> | Output

export type NoInputFlowFn = (river: RiverContext) => Promise<void> | void

export interface FlowOptions {
  name: string
  description?: string
  cache?: boolean
  timeout?: number
}

export interface Flow<Input extends object = EmptyInput, Output = void> {
  readonly name: string
  readonly options: Required<FlowOptions>
  readonly execute: FlowFn<Input, Output>
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

type SupportedFlowFn<Input extends object, Output> = FlowFn<Input, Output> | NoInputFlowFn

function createExecute<Input extends object, Output>(fn: SupportedFlowFn<Input, Output>): FlowFn<Input, Output> {
  if (fn.length <= 1) {
    return async (river: RiverContext) => {
      const noInputFlowFn = fn as NoInputFlowFn
      return await noInputFlowFn(river) as Output
    }
  }

  return fn as FlowFn<Input, Output>
}

export function flow(name: string, fn: NoInputFlowFn): Flow
export function flow(options: FlowOptions, fn: NoInputFlowFn): Flow
export function flow<Input extends object, Output>(name: string, fn: FlowFn<Input, Output>): Flow<Input, Output>
export function flow<Input extends object, Output>(options: FlowOptions, fn: FlowFn<Input, Output>): Flow<Input, Output>
export function flow<Input extends object, Output>(
  nameOrOptions: string | FlowOptions,
  fn: SupportedFlowFn<Input, Output>,
): Flow<Input, Output> {
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
    execute: createExecute(fn),
    __brand: 'river-flow',
  }
}

export function isFlow(value: unknown): value is Flow<object, unknown> {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<Flow<object, unknown>>
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
