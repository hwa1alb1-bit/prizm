import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const productionImage = '"image": "../kotlin-extractor/Dockerfile"'
const dryRunImage = process.env.CLOUDFLARE_EXTRACTOR_DRY_RUN_IMAGE?.trim()
  ? process.env.CLOUDFLARE_EXTRACTOR_DRY_RUN_IMAGE.trim()
  : 'docker.io/library/eclipse-temurin:21-jre'

const repoRoot = process.cwd()
const workerDir = join(repoRoot, 'workers', 'cloudflare-extractor')
const sourceConfigPath = join(workerDir, 'wrangler.jsonc')

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), 'prizm-cloudflare-extractor-dry-run-'))
  const tempConfigPath = join(workerDir, `.wrangler-dry-run.${process.pid}.${Date.now()}.jsonc`)
  const tempOutDir = join(tempDir, 'out')

  try {
    const sourceConfig = await readFile(sourceConfigPath, 'utf8')
    if (!sourceConfig.includes(productionImage)) {
      throw new Error(
        `${basename(sourceConfigPath)} must keep the production container image pointed at ../kotlin-extractor/Dockerfile.`,
      )
    }

    await writeFile(
      tempConfigPath,
      sourceConfig.replace(productionImage, `"image": "${dryRunImage}"`),
      'utf8',
    )

    console.log(`Running Wrangler dry run with pre-built validation image ${dryRunImage}.`)
    console.log(
      'This validates Worker bundling and bindings without requiring local Docker; use the production config with Docker for image-build proof.',
    )

    await runWranglerDryRun(tempConfigPath, tempOutDir)
  } finally {
    await rm(tempConfigPath, { force: true })
    await rm(tempDir, { force: true, recursive: true })
  }
}

function runWranglerDryRun(configPath: string, outDir: string) {
  const wranglerBin = join(repoRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  const args = [wranglerBin, 'deploy', '--config', configPath, '--dry-run', '--outdir', outDir]

  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: workerDir,
      env: process.env,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`wrangler dry run failed with exit code ${code ?? 'unknown'}.`))
    })
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
