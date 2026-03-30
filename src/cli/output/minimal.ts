import { consola } from 'consola'
import type { Reporter, StepEvent } from './reporter.js'

export class MinimalReporter implements Reporter {
  #steps = 0
  #totalDuration = 0

  onFlowStart(flowName: string, environment: string): void {
    consola.log(`vivr ▸ ${flowName} (${environment})`)
  }

  onStepComplete(event: StepEvent): void {
    this.#steps += 1
    this.#totalDuration += event.duration
    consola.log(`✓ ${event.flowName}  ${event.status}  ${event.duration}ms`)
  }

  onFlowEnd(_flowName: string, _success: boolean, _duration: number): void {
  }

  onLog(message: string): void {
    consola.log(message)
  }

  summary(): void {
    const noun = this.#steps === 1 ? 'step' : 'steps'
    consola.log(`${this.#steps} ${noun} completed in ${this.#totalDuration}ms`)
  }
}
