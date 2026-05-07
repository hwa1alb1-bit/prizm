import 'server-only'

const REQUIRED_ALIASES = ['prizmview.app', 'www.prizmview.app'] as const

export type ReleaseEvidence = {
  localHead: string
  originMainSha: string
  githubMainSha: string
  vercelDeployment: {
    readyState: string
    target: string | null
    url: string
    githubCommitSha: string
    aliases: string[]
  }
  liveHealth: {
    status: string
    version: string
  }
}

export type ReleaseInvariantResult = {
  ok: boolean
  failures: string[]
}

export function evaluateReleaseInvariant(evidence: ReleaseEvidence): ReleaseInvariantResult {
  const failures: string[] = []
  const localHead = evidence.localHead

  if (evidence.originMainSha !== localHead) {
    failures.push(`origin/main ${evidence.originMainSha} does not match local HEAD ${localHead}.`)
  }

  if (evidence.githubMainSha !== localHead) {
    failures.push(`GitHub main ${evidence.githubMainSha} does not match local HEAD ${localHead}.`)
  }

  if (evidence.vercelDeployment.githubCommitSha !== localHead) {
    failures.push(
      `Vercel production ${evidence.vercelDeployment.githubCommitSha} does not match local HEAD ${localHead}.`,
    )
  }

  if (evidence.liveHealth.version !== localHead) {
    failures.push(
      `Live health version ${evidence.liveHealth.version} does not match local HEAD ${localHead}.`,
    )
  }

  if (evidence.vercelDeployment.readyState !== 'READY') {
    failures.push(
      `Vercel production deployment is ${evidence.vercelDeployment.readyState}, not READY.`,
    )
  }

  if (evidence.vercelDeployment.target !== 'production') {
    failures.push(
      `Vercel deployment target is ${evidence.vercelDeployment.target ?? 'null'}, not production.`,
    )
  }

  if (evidence.liveHealth.status !== 'ok') {
    failures.push(`Live health status is ${evidence.liveHealth.status}, not ok.`)
  }

  const aliases = new Set(evidence.vercelDeployment.aliases)
  const missingAliases = REQUIRED_ALIASES.filter((alias) => !aliases.has(alias))

  if (missingAliases.length > 0) {
    failures.push(`Vercel production aliases are missing ${missingAliases.join(', ')}.`)
  }

  return { ok: failures.length === 0, failures }
}
