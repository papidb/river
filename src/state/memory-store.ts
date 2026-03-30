import type { StateStore } from './types.js'

export class MemoryStore implements StateStore {
  readonly #store = new Map<string, unknown>()

  set(key: string, value: unknown): void {
    this.#store.set(key, value)
  }

  get<T = unknown>(key: string): T | undefined {
    return this.#store.get(key) as T | undefined
  }
}
