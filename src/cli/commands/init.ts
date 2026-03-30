import { createInterface } from 'node:readline/promises'
import { access } from 'node:fs/promises'
import { stdin as input, stdout as output } from 'node:process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { defineCommand } from 'citty'
import { consola } from 'consola'
import { scaffoldProject, type PackageManager } from '../../init/scaffolder.js'
import { VIVR_VERSION } from '../version.js'

const DEFAULT_PROJECT_NAME = 'vivr-project'
const DEFAULT_BASE_URL = 'http://localhost:3000'
const DEFAULT_PACKAGE_MANAGER: PackageManager = 'pnpm'
const execFileAsync = promisify(execFile)

function isPackageManager(value: string): value is PackageManager {
  return value === 'bun' || value === 'pnpm' || value === 'npm' || value === 'yarn'
}

async function ask(question: string, fallback: string): Promise<string> {
  const rl = createInterface({ input, output })
  try {
    const answer = (await rl.question(`${question} (${fallback}): `)).trim()
    return answer || fallback
  } finally {
    rl.close()
  }
}

async function askBoolean(question: string, fallback: boolean): Promise<boolean> {
  const fallbackLabel = fallback ? 'Y/n' : 'y/N'
  const answer = (await ask(question, fallbackLabel)).toLowerCase()

  if (answer === fallbackLabel.toLowerCase()) {
    return fallback
  }

  return answer === 'y' || answer === 'yes'
}

async function resolvePackageManager(value: string | undefined, yes: boolean): Promise<PackageManager> {
  if (value && isPackageManager(value)) {
    return value
  }

  if (yes || !process.stdin.isTTY) {
    return DEFAULT_PACKAGE_MANAGER
  }

  while (true) {
    const answer = await ask('Package manager [bun/pnpm/npm/yarn]', DEFAULT_PACKAGE_MANAGER)
    if (isPackageManager(answer)) {
      return answer
    }
    consola.warn('Please choose one of: bun, pnpm, npm, yarn')
  }
}

async function resolveBaseUrl(value: string | undefined, yes: boolean): Promise<string> {
  if (value) {
    return value
  }

  if (yes || !process.stdin.isTTY) {
    return DEFAULT_BASE_URL
  }

  return ask('Default base URL', DEFAULT_BASE_URL)
}

async function resolveGitExclude(value: boolean | undefined, yes: boolean): Promise<boolean> {
  if (typeof value === 'boolean') {
    return value
  }

  if (yes || !process.stdin.isTTY) {
    return false
  }

  return askBoolean('Add generated folder to parent git exclude when possible?', false)
}

function resolveDependencySpec(useLocal: boolean): string {
  if (useLocal) {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
    return `file:${packageRoot}`
  }

  return `^${VIVR_VERSION}`
}

async function ensureLocalBuild(): Promise<void> {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
  const distBin = resolve(packageRoot, 'dist', 'bin', 'vivr.mjs')

  try {
    await access(distBin)
    return
  } catch {
    consola.log('Building local vivr package for --local...')
  }

  await execFileAsync('pnpm', ['build'], { cwd: packageRoot })
}

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Scaffold a new rivr project',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Project directory name',
      required: false,
    },
    'package-manager': {
      type: 'string',
      description: 'Package manager to write into the generated project',
    },
    'base-url': {
      type: 'string',
      description: 'Default base URL for the generated health-check project',
    },
    'git-exclude': {
      type: 'boolean',
      description: 'Add the generated folder to the nearest parent .git/info/exclude when possible',
    },
    local: {
      type: 'boolean',
      description: 'Use a local file dependency for rivr instead of the published npm version',
    },
    yes: {
      type: 'boolean',
      alias: 'y',
      description: 'Accept default answers',
    },
  },
  async run({ args }) {
    const yes = args.yes === true
    const useLocal = args.local === true
    const projectName = typeof args.name === 'string' && args.name.length > 0 ? args.name : DEFAULT_PROJECT_NAME
    const packageManager = await resolvePackageManager(
      typeof args['package-manager'] === 'string' ? args['package-manager'] : undefined,
      yes,
    )
    const baseUrl = await resolveBaseUrl(typeof args['base-url'] === 'string' ? args['base-url'] : undefined, yes)
    const gitExclude = await resolveGitExclude(args['git-exclude'] === true ? true : undefined, yes)
    if (useLocal) {
      await ensureLocalBuild()
    }

    const dependencySpec = resolveDependencySpec(useLocal)

    const targetDir = await scaffoldProject({
      cwd: process.cwd(),
      projectName,
      packageManager,
      baseUrl,
      dependencySpec,
      gitExclude,
    })

    consola.log('')
    consola.log('Next:')
    consola.log(`  cd ${targetDir}`)
    consola.log(`  ${packageManager} install`)
    consola.log('  rivr run health-check')
  },
})
