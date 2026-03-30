export interface VivResponse<T = unknown> {
  status: number
  statusText: string
  headers: Record<string, string>
  data: T
  duration: number
  size: number
  ok: boolean
}

export interface RequestOptions {
  headers?: Record<string, string>
  timeout?: number
  schema?: unknown
  raw?: boolean
}
