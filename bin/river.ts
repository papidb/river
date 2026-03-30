#!/usr/bin/env node

import { runCli } from '../src/cli/index.js'
import { formatCliError } from '../src/cli/format-error.js'
import { consola } from 'consola'

try {
  await runCli()
} catch (error: unknown) {
  consola.error(formatCliError(error))
  process.exitCode = 1
}
