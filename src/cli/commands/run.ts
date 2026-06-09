import { defineCommand } from 'citty'
import { FlowRunner } from '../../core/runner.js'

const KNOWN_FLAGS = new Set(['env'])

function parseFlowArgs(): Record<string, string> {
  const rawArgs = process.argv.slice(2)
  const result: Record<string, string> = {}

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]

    // --key=value
    if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=')
      const key = arg.slice(2, eq)
      if (!KNOWN_FLAGS.has(key)) {
        result[key] = arg.slice(eq + 1)
      }
      continue
    }

    // --key value (where value is not another flag)
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      if (KNOWN_FLAGS.has(key)) {
        i++
        continue
      }
      const next = rawArgs[i + 1]
      if (next !== undefined && !next.startsWith('-')) {
        result[key] = next
        i++
      } else {
        result[key] = 'true'
      }
    }
  }

  return result
}

export const runCommand = defineCommand({
  meta: {
    name: 'run',
    description: 'Run a flow by name',
  },
  args: {
    flow: {
      type: 'positional',
      description: 'Flow name to run',
      required: true,
    },
    env: {
      type: 'string',
      description: 'Environment name',
    },
  },
  async run({ args }) {
    const flowArgs = parseFlowArgs()
    const runner = new FlowRunner()
    await runner.run(args.flow, {
      env: typeof args.env === 'string' ? args.env : undefined,
      flowArgs: Object.keys(flowArgs).length > 0 ? flowArgs : undefined,
    })
  },
})
