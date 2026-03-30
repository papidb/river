import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createJiti } from 'jiti'
import { VivConfigError } from '../core/errors.js'
import type { VivConfig } from './types.js'

const CONFIG_FILE = 'vivr.config.ts'

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function findConfigFile(startDir: string): Promise<string> {
  let cursor = startDir

  while (true) {
    const candidate = join(cursor, CONFIG_FILE)
    if (await exists(candidate)) {
      return candidate
    }

    const parent = dirname(cursor)
    if (parent === cursor) {
      break
    }
    cursor = parent
  }

  throw new VivConfigError(`Could not find ${CONFIG_FILE} (searched from ${startDir} upward)`)
}

export async function loadConfig(startDir: string): Promise<{ config: VivConfig; configPath: string; projectRoot: string }> {
  const configPath = await findConfigFile(startDir)
  const projectRoot = dirname(configPath)

  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined'
  const loaded = isBun
    ? await import(pathToFileURL(configPath).href)
    : await createJiti(import.meta.url).import(configPath)

  const config = (loaded.default ?? loaded) as VivConfig

  if (!config || typeof config !== 'object') {
    throw new VivConfigError(`Invalid ${CONFIG_FILE}: expected object export`)
  }

  if (!config.environments || Object.keys(config.environments).length === 0) {
    throw new VivConfigError('Config must define at least one environment')
  }

  return { config, configPath, projectRoot }
}
