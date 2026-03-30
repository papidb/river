import { consola } from 'consola'
import type { Reporter, StepEvent } from './reporter.js'

export class MinimalReporter implements Reporter {
  #steps = 0
  #totalDuration = 0
  #success = true

  onFlowStart(flowName: string, environment: string): void {
    consola.log(`river ▸ ${flowName} (${environment})`)
  }

  onStepComplete(event: StepEvent): void {
    this.#steps += 1
    this.#totalDuration += event.duration
    consola.log(`✓ ${event.flowName}  ${event.status}  ${event.duration}ms`)
  }

  onFlowEnd(_flowName: string, success: boolean, _duration: number): void {
    this.#success = success
  }

  onLog(message: string): void {
    consola.log(message)
  }

  summary(): void {
    const noun = this.#steps === 1 ? 'step' : 'steps'
    const status = this.#success ? 'all passed' : 'failed'
    consola.log(`${this.#steps} ${noun} completed in ${this.#totalDuration}ms · ${status}`)
  }
}
