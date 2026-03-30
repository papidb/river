import { defineCommand, runMain } from 'citty'
import { consola } from 'consola'
import { runCommand } from './commands/run.js'

export const cli = defineCommand({
  meta: {
    name: 'vivr',
    description: 'API workflow orchestration CLI',
    version: '0.1.0',
  },
  subCommands: {
    run: runCommand,
  },
})

export async function runCli(rawArgs = process.argv.slice(2)): Promise<void> {
  try {
    await runMain(cli, { rawArgs })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    consola.error(message)
    process.exitCode = 1
  }
}
