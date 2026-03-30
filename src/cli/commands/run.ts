import { defineCommand } from 'citty'
import { FlowRunner } from '../../core/runner.js'

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
    const runner = new FlowRunner()
    await runner.run(args.flow, {
      env: typeof args.env === 'string' ? args.env : undefined,
    })
  },
})
