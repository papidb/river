import { defineCommand, renderUsage, runCommand as executeCommand } from 'citty'
import { consola } from 'consola'
import { initCommand } from './commands/init.js'
import { runCommand } from './commands/run.js'
import { formatCliError } from './format-error.js'
import { VIVR_VERSION } from './version.js'

export const cli = defineCommand({
  meta: {
    name: 'river',
    description: 'API workflow orchestration CLI',
    version: VIVR_VERSION,
  },
  subCommands: {
    init: initCommand,
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
      consola.log(VIVR_VERSION)
      return
    }

    await executeCommand(cli, { rawArgs })
  } catch (error: unknown) {
    consola.error(formatCliError(error))
    process.exitCode = 1
  }
}
