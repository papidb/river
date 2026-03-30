export interface StateStore {
  set(key: string, value: unknown): void
  get<T = unknown>(key: string): T | undefined
}
