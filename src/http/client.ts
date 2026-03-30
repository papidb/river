import { VivHttpError } from '../core/errors.js'
import type { RequestOptions, VivResponse } from './types.js'

export interface HttpStepResult {
  flowName: string
  method: string
  url: string
  status: number
  duration: number
}

interface HttpClientOptions {
  baseUrl: string
  defaultHeaders?: Record<string, string>
  timeout?: number
  getSessionHeaders?: () => Record<string, string>
  getFlowName?: () => string
  onStepComplete?: (step: HttpStepResult) => void
}

const DEFAULT_TIMEOUT = 30_000

function isAbsoluteUrl(input: string): boolean {
  return input.startsWith('http://') || input.startsWith('https://')
}

function resolveUrl(input: string, baseUrl: string): string {
  if (isAbsoluteUrl(input)) {
    return input
  }

  const base = baseUrl.replace(/\/+$/, '')
  const path = input.startsWith('/') ? input : `/${input}`
  return `${base}${path}`
}

function buildHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })
  return headers
}

function parseResponseBody(rawBody: string, rawMode: boolean): unknown {
  if (rawMode) {
    return rawBody
  }

  try {
    return JSON.parse(rawBody) as unknown
  } catch {
    return rawBody
  }
}

function toBodyInit(value: unknown): BodyInit {
  if (typeof value === 'string') {
    return value
  }

  if (value instanceof FormData) {
    return value
  }

  if (value instanceof URLSearchParams) {
    return value
  }

  if (value instanceof Blob) {
    return value
  }

  if (value instanceof ArrayBuffer) {
    return value
  }

  return JSON.stringify(value)
}

export class HttpClient {
  readonly #baseUrl: string
  readonly #defaultHeaders: Record<string, string>
  readonly #defaultTimeout: number
  readonly #getSessionHeaders: (() => Record<string, string>) | undefined
  readonly #getFlowName: (() => string) | undefined
  readonly #onStepComplete: ((step: HttpStepResult) => void) | undefined

  constructor(options: HttpClientOptions) {
    this.#baseUrl = options.baseUrl
    this.#defaultHeaders = options.defaultHeaders ?? {}
    this.#defaultTimeout = options.timeout ?? DEFAULT_TIMEOUT
    this.#getSessionHeaders = options.getSessionHeaders
    this.#getFlowName = options.getFlowName
    this.#onStepComplete = options.onStepComplete
  }

  async get<T = unknown>(url: string, options?: RequestOptions): Promise<VivResponse<T>> {
    return this.request<T>('GET', url, undefined, options)
  }

  async post<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<VivResponse<T>> {
    return this.request<T>('POST', url, body, options)
  }

  async put<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<VivResponse<T>> {
    return this.request<T>('PUT', url, body, options)
  }

  async delete<T = unknown>(url: string, options?: RequestOptions): Promise<VivResponse<T>> {
    return this.request<T>('DELETE', url, undefined, options)
  }

  async patch<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<VivResponse<T>> {
    return this.request<T>('PATCH', url, body, options)
  }

  async request<T = unknown>(
    method: string,
    url: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<VivResponse<T>> {
    const fullUrl = resolveUrl(url, this.#baseUrl)
    const sessionHeaders = this.#getSessionHeaders?.() ?? {}
    const requestHeaders = options?.headers ?? {}
    const headers: Record<string, string> = {
      ...this.#defaultHeaders,
      ...sessionHeaders,
      ...requestHeaders,
    }

    const timeout = options?.timeout ?? this.#defaultTimeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, timeout)

    let bodyToSend: BodyInit | undefined
    if (body !== undefined) {
      bodyToSend = toBodyInit(body)
      if (!('Content-Type' in headers) && !('content-type' in headers) && !(bodyToSend instanceof FormData)) {
        headers['Content-Type'] = 'application/json'
      }
    }

    const startedAt = Date.now()

    try {
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: bodyToSend,
        signal: controller.signal,
      })

      const rawBody = await response.text()
      const duration = Math.max(1, Date.now() - startedAt)
      const parsedData = parseResponseBody(rawBody, options?.raw === true)
      const size = new TextEncoder().encode(rawBody).length

      this.#onStepComplete?.({
        flowName: this.#getFlowName?.() ?? 'unknown-flow',
        method,
        url: fullUrl,
        status: response.status,
        duration,
      })

      if (!response.ok) {
        throw new VivHttpError(response.status, response.statusText, fullUrl, method, parsedData, duration)
      }

      const result: VivResponse<T> = {
        status: response.status,
        statusText: response.statusText,
        headers: buildHeaders(response),
        data: parsedData as T,
        duration,
        size,
        ok: response.ok,
      }

      return result
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

export { resolveUrl }
