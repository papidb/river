import { RiverConfigError, RiverError, RiverFlowError, RiverHttpError } from '../core/errors.js'

function stringifyBody(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function truncate(value: string, maxLength = 500): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}…`
}

export function formatCliError(error: unknown): string {
  if (error instanceof RiverFlowError) {
    const cause = error.cause

    if (cause instanceof RiverHttpError) {
      const body = truncate(stringifyBody(cause.responseBody))
      return [
        `Flow failed: ${error.flowName}`,
        `${cause.method} ${cause.url}`,
        `HTTP ${cause.status} ${cause.statusText} in ${cause.duration}ms`,
        body ? `Response:\n${body}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    }

    if (cause instanceof RiverConfigError) {
      return [`Flow failed: ${error.flowName}`, cause.message].join('\n')
    }

    if (cause instanceof RiverError) {
      return [`Flow failed: ${error.flowName}`, `[${cause.code}] ${cause.message}`].join('\n')
    }

    return [`Flow failed: ${error.flowName}`, cause.message].join('\n')
  }

  if (error instanceof RiverHttpError) {
    const body = truncate(stringifyBody(error.responseBody))
    return [
      `${error.method} ${error.url}`,
      `HTTP ${error.status} ${error.statusText} in ${error.duration}ms`,
      body ? `Response:\n${body}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (error instanceof RiverError) {
    return `[${error.code}] ${error.message}`
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
