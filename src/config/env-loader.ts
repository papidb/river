import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { config as loadDotEnv } from 'dotenv'

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function loadEnvFiles(projectRoot: string, environment: string): Promise<void> {
  const rootEnv = join(projectRoot, '.env')
  const envSpecific = join(projectRoot, 'environments', `${environment}.env`)

  if (await fileExists(rootEnv)) {
    loadDotEnv({ path: rootEnv })
  }

  if (await fileExists(envSpecific)) {
    loadDotEnv({ path: envSpecific, override: true })
  }
}
