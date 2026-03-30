export interface StepEvent {
  flowName: string
  method: string
  url: string
  status: number
  duration: number
}

export interface Reporter {
  onFlowStart(flowName: string, environment: string): void
  onStepComplete(event: StepEvent): void
  onFlowEnd(flowName: string, success: boolean, duration: number): void
  onLog(message: string): void
  summary(): void
}
