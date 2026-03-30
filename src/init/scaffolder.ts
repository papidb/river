import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { consola } from 'consola'
import { VivConfigError } from '../core/errors.js'
import { configTemplate } from './templates/config.js'
import { envExampleTemplate } from './templates/env.js'
import { healthCheckFlowTemplate } from './templates/flow.js'
import { gitignoreTemplate } from './templates/gitignore.js'
import { packageTemplate } from './templates/package.js'
import { projectTsconfigTemplate } from './templates/tsconfig.js'

export type PackageManager = 'bun' | 'pnpm' | 'npm' | 'yarn'

export interface ScaffoldProjectOptions {
  cwd: string
  projectName: string
  packageManager: PackageManager
  baseUrl: string
  dependencySpec: string
  gitExclude: boolean
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

async function writeFileWithLog(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, 'utf8')
  consola.log(`  ✓ ${filePath.split('/').pop()}`)
}

async function findGitRoot(startDir: string): Promise<string | null> {
  let current = resolve(startDir)

  while (true) {
    const gitDir = resolve(current, '.git')
    if (await pathExists(gitDir)) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) {
      return null
    }

    current = parent
  }
}

async function appendToGitExclude(targetDir: string): Promise<void> {
  const gitRoot = await findGitRoot(dirname(targetDir))
  if (!gitRoot) {
    consola.warn('No parent git repository found; skipping .git/info/exclude update')
    return
  }

  const relativeTarget = relative(gitRoot, targetDir).replaceAll('\\', '/')
  if (!relativeTarget || relativeTarget === '.') {
    throw new VivConfigError('Refusing to add the repository root itself to .git/info/exclude')
  }

  const excludePath = resolve(gitRoot, '.git', 'info', 'exclude')
  const existing = (await pathExists(excludePath)) ? await readFile(excludePath, 'utf8') : ''
  const lines = new Set(existing.split('\n').filter(Boolean))
  lines.add(`${relativeTarget}/`)

  await writeFile(excludePath, `${Array.from(lines).join('\n')}\n`, 'utf8')
  consola.log(`  ✓ added ${relativeTarget}/ to ${relative(gitRoot, excludePath)}`)
}

export async function scaffoldProject(options: ScaffoldProjectOptions): Promise<string> {
  const targetDir = resolve(options.cwd, options.projectName)

  if (await pathExists(targetDir)) {
    const targetStats = await stat(targetDir)
    if (targetStats.isDirectory()) {
      const configPath = resolve(targetDir, 'river.config.ts')
      if (await pathExists(configPath)) {
        throw new VivConfigError(`Target directory already contains a river project: ${targetDir}`)
      }

      const dirEntries = await readdir(targetDir)
      if (dirEntries.length > 0) {
        throw new VivConfigError(`Target directory is not empty: ${targetDir}`)
      }
    } else {
      throw new VivConfigError(`Target path exists and is not a directory: ${targetDir}`)
    }
  }

  await ensureDir(resolve(targetDir, 'flows'))
  await ensureDir(resolve(targetDir, 'environments'))
  await ensureDir(resolve(targetDir, '.river'))

  consola.log(`Creating ${options.projectName}/...`)

  await writeFileWithLog(resolve(targetDir, 'river.config.ts'), configTemplate(options.projectName, options.baseUrl))
  await writeFileWithLog(resolve(targetDir, 'flows', 'health-check.ts'), healthCheckFlowTemplate())
  await writeFileWithLog(resolve(targetDir, 'environments', 'dev.env'), '')
  await writeFileWithLog(resolve(targetDir, '.env.example'), envExampleTemplate())
  await writeFileWithLog(resolve(targetDir, '.gitignore'), gitignoreTemplate())
  await writeFileWithLog(resolve(targetDir, 'package.json'), packageTemplate(options.projectName, options.dependencySpec))
  await writeFileWithLog(resolve(targetDir, 'tsconfig.json'), projectTsconfigTemplate())

  if (options.gitExclude) {
    await appendToGitExclude(targetDir)
  }

  return targetDir
}
