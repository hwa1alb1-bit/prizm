import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { evaluateReleaseInvariant, type ReleaseEvidence } from '@/lib/server/release-invariant'

const execFileAsync = promisify(execFile)

const config = {
  githubRepo: process.env.RELEASE_GITHUB_REPO ?? 'hwa1alb1-bit/prizm',
  vercelProject: process.env.RELEASE_VERCEL_PROJECT ?? 'prizm',
  vercelScope: process.env.RELEASE_VERCEL_SCOPE ?? 'plknokos-projects',
  liveSiteUrl: process.env.RELEASE_LIVE_SITE_URL ?? 'https://prizmview.app',
}

type VercelListDeployment = {
  url: string
  state: string
  target: string | null
  meta?: {
    githubCommitRef?: string
    githubCommitSha?: string
  }
}

type VercelListOutput = {
  deployments?: VercelListDeployment[]
}

type VercelInspectOutput = {
  aliases?: string[]
}

type LiveHealthOutput = {
  status?: string
  version?: string
}

async function main(): Promise<void> {
  const evidence = await collectReleaseEvidence()
  const result = evaluateReleaseInvariant(evidence)

  console.log(JSON.stringify({ ok: result.ok, evidence, failures: result.failures }, null, 2))

  if (!result.ok) {
    process.exitCode = 1
  }
}

async function collectReleaseEvidence(): Promise<ReleaseEvidence> {
  const [localHead, originMainSha, githubMainSha, vercelList, liveHealth] = await Promise.all([
    runText('git', ['rev-parse', 'HEAD']),
    runText('git', ['rev-parse', 'origin/main']),
    runText('gh', ['api', `repos/${config.githubRepo}/commits/main`, '--jq', '.sha']),
    listVercelDeployments(),
    fetchLiveHealth(),
  ])

  const deployment = findProductionDeployment(vercelList)
  const inspection = await inspectVercelDeployment(deployment.url)

  return {
    localHead,
    originMainSha,
    githubMainSha,
    vercelDeployment: {
      readyState: deployment.state,
      target: deployment.target,
      url: deployment.url,
      githubCommitSha: deployment.meta?.githubCommitSha ?? '',
      aliases: inspection.aliases ?? [],
    },
    liveHealth: {
      status: liveHealth.status ?? 'unknown',
      version: liveHealth.version ?? 'unknown',
    },
  }
}

async function listVercelDeployments(): Promise<VercelListOutput> {
  const output = await runNpx([
    'vercel',
    'ls',
    config.vercelProject,
    '--scope',
    config.vercelScope,
    '--format=json',
    '--environment',
    'production',
    '--status',
    'READY',
  ])

  return parseJsonObject<VercelListOutput>(output)
}

async function inspectVercelDeployment(url: string): Promise<VercelInspectOutput> {
  const output = await runNpx([
    'vercel',
    'inspect',
    url,
    '--scope',
    config.vercelScope,
    '--format=json',
  ])

  return parseJsonObject<VercelInspectOutput>(output)
}

async function fetchLiveHealth(): Promise<LiveHealthOutput> {
  const response = await fetch(`${config.liveSiteUrl.replace(/\/$/, '')}/api/health`, {
    headers: { 'cache-control': 'no-store' },
  })

  if (!response.ok) {
    throw new Error(`Live health request failed with HTTP ${response.status}`)
  }

  return (await response.json()) as LiveHealthOutput
}

function findProductionDeployment(output: VercelListOutput): VercelListDeployment {
  const deployment = output.deployments?.find(
    (candidate) =>
      candidate.state === 'READY' &&
      candidate.target === 'production' &&
      candidate.meta?.githubCommitRef === 'main' &&
      Boolean(candidate.meta.githubCommitSha),
  )

  if (!deployment) {
    throw new Error('No READY production Vercel deployment for main was found.')
  }

  return deployment
}

async function runText(command: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  })

  return stdout.trim()
}

function parseJsonObject<T>(output: string): T {
  try {
    return JSON.parse(output) as T
  } catch {
    const start = output.indexOf('{')
    const end = output.lastIndexOf('}')

    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Command output did not contain a JSON object.')
    }

    return JSON.parse(output.slice(start, end + 1)) as T
  }
}

async function runNpx(args: string[]): Promise<string> {
  if (process.platform !== 'win32') return runText('npx', args)

  const command = ['npx', ...args].join(' ')
  return runText('cmd.exe', ['/d', '/s', '/c', command])
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
