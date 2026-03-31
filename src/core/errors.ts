export class RiverError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'RiverError'
    this.code = code
  }
}

export class RiverHttpError extends RiverError {
  readonly status: number
  readonly statusText: string
  readonly url: string
  readonly method: string
  readonly responseBody: unknown
  readonly duration: number

  constructor(
    status: number,
    statusText: string,
    url: string,
    method: string,
    responseBody: unknown,
    duration: number,
  ) {
    super(`${method} ${url} → ${status} ${statusText}`, 'HTTP_ERROR')
    this.name = 'RiverHttpError'
    this.status = status
    this.statusText = statusText
    this.url = url
    this.method = method
    this.responseBody = responseBody
    this.duration = duration
  }
}

export class RiverFlowError extends RiverError {
  readonly flowName: string
  readonly cause: Error

  constructor(flowName: string, cause: Error) {
    super(`Flow "${flowName}" failed: ${cause.message}`, 'FLOW_ERROR')
    this.name = 'RiverFlowError'
    this.flowName = flowName
    this.cause = cause
  }
}

export class RiverConfigError extends RiverError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR')
    this.name = 'RiverConfigError'
  }
}
