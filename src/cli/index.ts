import { defineCommand, renderUsage, runCommand as executeCommand } from 'citty'
import { consola } from 'consola'
import { runCommand } from './commands/run.js'
import { formatCliError } from './format-error.js'

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
    if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
      consola.log(await renderUsage(cli))
      return
    }

    if (rawArgs.length === 1 && rawArgs[0] === '--version') {
      consola.log('0.1.0')
      return
    }

    await executeCommand(cli, { rawArgs })
  } catch (error: unknown) {
    consola.error(formatCliError(error))
    process.exitCode = 1
  }
}
