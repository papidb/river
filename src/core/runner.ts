import { MinimalReporter } from '../cli/output/minimal.js'
import type { Reporter } from '../cli/output/reporter.js'
import { loadConfig } from '../config/loader.js'
import { loadEnvFiles } from '../config/env-loader.js'
import { HttpClient } from '../http/client.js'
import { MemoryStore } from '../state/memory-store.js'
import { VivConfigError, VivFlowError } from './errors.js'
import { isDeclarativeFlow, type Flow } from './flow.js'
import { loadFlowByName } from './loader.js'
import { VivContextImpl } from './context.js'

export interface RunOptions {
  env?: string
  cwd?: string
  reporter?: Reporter
}

export class FlowRunner {
  async run(flowName: string, options: RunOptions = {}): Promise<void> {
    const cwd = options.cwd ?? process.cwd()
    const reporter = options.reporter ?? new MinimalReporter()

    const { config, projectRoot } = await loadConfig(cwd)

    const availableEnvironments = Object.keys(config.environments)
    const targetEnv = options.env ?? config.defaultEnv ?? availableEnvironments[0]

    if (!targetEnv || !config.environments[targetEnv]) {
      throw new VivConfigError(`Environment "${targetEnv}" not found in rivr.config.ts`)
    }

    const envConfig = config.environments[targetEnv]

    await loadEnvFiles(projectRoot, targetEnv)

    reporter.onFlowStart(flowName, targetEnv)

    const loaded = await loadFlowByName(projectRoot, config.flowsDir ?? './flows', flowName)
    if (isDeclarativeFlow(loaded)) {
      throw new VivConfigError(`Declarative flow "${loaded.name}" is not supported in Phase 1`)
    }

    const flow = loaded as Flow
    const stateStore = new MemoryStore()
    const persistentStore = new MemoryStore()
    const flowNameRef = { name: flow.name }
    const sessionHeaders: Record<string, string> = {}

    const baseHeaders: Record<string, string> = {
      ...(config.defaults?.headers ?? {}),
      ...(envConfig.headers ?? {}),
    }

    const client = new HttpClient({
      baseUrl: envConfig.baseUrl,
      defaultHeaders: baseHeaders,
      timeout: config.defaults?.timeout ?? 30_000,
      getSessionHeaders: () => sessionHeaders,
      getFlowName: () => flowNameRef.name,
      onStepComplete: (event) => {
        reporter.onStepComplete(event)
      },
    })

    const context = new VivContextImpl({
      environment: targetEnv,
      flowNameRef,
      httpClient: client,
      stateStore,
      persistentStore,
      envVars: envConfig.vars ?? {},
      sessionHeaders,
      reporter,
    })

    const startedAt = Date.now()

    try {
      await context.run(flow)
      reporter.onFlowEnd(flow.name, true, Math.max(1, Date.now() - startedAt))
    } catch (error: unknown) {
      reporter.onFlowEnd(flow.name, false, Math.max(1, Date.now() - startedAt))
      if (error instanceof Error) {
        throw new VivFlowError(flow.name, error)
      }
      throw new VivFlowError(flow.name, new Error(String(error)))
    } finally {
      reporter.summary()
    }
  }
}
