import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createJiti } from 'jiti'
import { VivConfigError } from './errors.js'
import { isDeclarativeFlow, isFlow, type DeclarativeFlow, type Flow } from './flow.js'

async function importTsModule(filePath: string): Promise<unknown> {
  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined'

  if (isBun) {
    return import(pathToFileURL(filePath).href)
  }

  return createJiti(import.meta.url).import(filePath)
}

export async function loadFlowFile(filePath: string): Promise<Flow | DeclarativeFlow> {
  const mod = (await importTsModule(filePath)) as { default?: unknown }
  const exported = mod.default ?? mod

  if (isFlow(exported)) {
    return exported
  }

  if (isDeclarativeFlow(exported)) {
    return exported
  }

  throw new VivConfigError(`Flow file ${filePath} must export a Flow or DeclarativeFlow as default`)
}

export async function loadFlowByName(projectRoot: string, flowsDir: string, flowName: string): Promise<Flow | DeclarativeFlow> {
  const flowPath = join(projectRoot, flowsDir, `${flowName}.ts`)
  return loadFlowFile(flowPath)
}
