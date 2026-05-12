import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const workerDir = path.join(repoRoot, 'workers', 'kotlin-extractor')
const command = process.platform === 'win32' ? 'gradlew.bat' : 'sh'
const args =
  process.platform === 'win32'
    ? ['test', ...process.argv.slice(2)]
    : ['gradlew', 'test', ...process.argv.slice(2)]

const result = spawnSync(command, args, {
  cwd: workerDir,
  env: process.env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
