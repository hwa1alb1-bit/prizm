import { describe, expect, it } from 'vitest'
import { evaluateReleaseInvariant, type ReleaseEvidence } from '@/lib/server/release-invariant'

const sha = '10e1087c59ff9a59c455799459df7b81d80b160e'

describe('release invariant', () => {
  it('passes when local, GitHub, Vercel, and live health agree on the same SHA', () => {
    expect(evaluateReleaseInvariant(goodEvidence()).ok).toBe(true)
  })

  it('fails with actionable drift messages when the live stack is stale', () => {
    const result = evaluateReleaseInvariant(
      goodEvidence({
        githubMainSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        vercelDeployment: {
          ...goodEvidence().vercelDeployment,
          githubCommitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          aliases: ['prizm-preview.vercel.app'],
        },
        liveHealth: {
          status: 'ok',
          version: 'dev',
        },
      }),
    )

    expect(result.ok).toBe(false)
    expect(result.failures).toEqual([
      'GitHub main aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa does not match local HEAD 10e1087c59ff9a59c455799459df7b81d80b160e.',
      'Vercel production bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb does not match local HEAD 10e1087c59ff9a59c455799459df7b81d80b160e.',
      'Live health version dev does not match local HEAD 10e1087c59ff9a59c455799459df7b81d80b160e.',
      'Vercel production aliases are missing prizmview.app, www.prizmview.app.',
    ])
  })
})

function goodEvidence(overrides: Partial<ReleaseEvidence> = {}): ReleaseEvidence {
  return {
    localHead: sha,
    originMainSha: sha,
    githubMainSha: sha,
    vercelDeployment: {
      readyState: 'READY',
      target: 'production',
      url: 'prizm-lh20glonj-plknokos-projects.vercel.app',
      githubCommitSha: sha,
      aliases: ['prizmview.app', 'www.prizmview.app'],
    },
    liveHealth: {
      status: 'ok',
      version: sha,
    },
    ...overrides,
  }
}
