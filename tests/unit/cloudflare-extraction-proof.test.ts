import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveHttpsCloudflareExtractorUrl,
  validateCloudflareExtractionProofArchive,
} from '@/lib/server/cloudflare-extraction-proof'

const validProofEnv = {
  CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID: 'cf-extraction-staging-2026-05-14T21-14-43-312Z',
  CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT: '2026-05-14T21:15:01.124Z',
  CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA:
    '6c236fa3548b3ff7c19e8585ffc565e5586a4ce5f8083704482b26bf0fe1b0b6',
}

describe('Cloudflare extraction proof archive', () => {
  it('validates the archived staging proof against launch env metadata', () => {
    expect(
      validateCloudflareExtractionProofArchive({
        env: validProofEnv,
        cwd: process.cwd(),
      }),
    ).toEqual({
      ok: true,
      evidencePath: expect.stringContaining('cf-extraction-staging-2026-05-14T21-14-43-312Z.json'),
    })
  })

  it('rejects malformed or mismatched proof metadata', () => {
    expect(
      validateCloudflareExtractionProofArchive({
        env: {
          ...validProofEnv,
          CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA:
            '0000000000000000000000000000000000000000000000000000000000000000',
        },
        cwd: process.cwd(),
      }),
    ).toEqual({
      ok: false,
      evidencePath: expect.stringContaining('cf-extraction-staging-2026-05-14T21-14-43-312Z.json'),
      failure: 'proof_archive_sha_mismatch',
    })
  })

  it('rejects a proof archive without explicit runtime requirement coverage', () => {
    const cwd = join(tmpdir(), `prizm-proof-${randomUUID()}`)
    const proofId = 'cf-extraction-staging-2026-05-14T21-14-43-312Z'
    const evidenceDir = join(cwd, 'docs', 'evidence', 'cloudflare-extraction')
    mkdirSync(evidenceDir, { recursive: true })
    const proof = {
      schemaVersion: 1,
      proofId,
      archivedAt: '2026-05-14T21:15:01.124Z',
      health: {
        status: 'ok',
        checks: {
          jobStateBucket: { ok: true },
          uploadBucket: { ok: true },
          extractionQueue: { ok: true },
          kotlinExtractor: { ok: true },
        },
      },
      extraction: {
        status: 'succeeded',
        jobId: 'cf_job_test',
        statementCount: 1,
        firstStatement: {
          ready: true,
          reconciles: true,
        },
      },
    }
    const sha = proofSha(proof)
    writeFileSync(
      join(evidenceDir, `${proofId}.json`),
      `${JSON.stringify({ ...proof, sha256: sha }, null, 2)}\n`,
      'utf8',
    )

    expect(
      validateCloudflareExtractionProofArchive({
        env: {
          CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID: proofId,
          CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT: proof.archivedAt,
          CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA: sha,
        },
        cwd,
      }),
    ).toEqual({
      ok: false,
      evidencePath: expect.stringContaining(`${proofId}.json`),
      failure: 'proof_archive_extraction_not_ready',
    })
  })

  it('requires HTTPS before a Worker bearer token is sent', () => {
    expect(resolveHttpsCloudflareExtractorUrl('https://example.workers.dev/')).toEqual({
      ok: true,
      url: 'https://example.workers.dev',
    })
    expect(resolveHttpsCloudflareExtractorUrl('http://example.workers.dev')).toEqual({
      ok: false,
      failure: 'extractor_url_insecure',
    })
    expect(resolveHttpsCloudflareExtractorUrl('not a url')).toEqual({
      ok: false,
      failure: 'extractor_url_invalid',
    })
  })
})

function proofSha(proof: Record<string, unknown>): string {
  return createHash('sha256')
    .update(`${JSON.stringify(proof, null, 2)}\n`)
    .digest('hex')
}
