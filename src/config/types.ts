export interface EnvironmentConfig {
  baseUrl: string
  headers?: Record<string, string>
  vars?: Record<string, string>
}

export interface RiverConfig {
  name?: string
  version?: string
  environments: Record<string, EnvironmentConfig>
  defaultEnv?: string
  defaults?: {
    headers?: Record<string, string>
    timeout?: number
  }
  flowsDir?: string
}

export function defineConfig<T extends RiverConfig>(config: T): T {
  return config
}
