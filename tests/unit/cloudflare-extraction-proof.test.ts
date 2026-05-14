import { describe, expect, it } from 'vitest'
import { validateCloudflareExtractionProofArchive } from '@/lib/server/cloudflare-extraction-proof'

const validProofEnv = {
  CLOUDFLARE_EXTRACTION_STAGING_PROOF_ID: 'cf-extraction-staging-2026-05-14T21-14-43-312Z',
  CLOUDFLARE_EXTRACTION_STAGING_PROOF_AT: '2026-05-14T21:15:01.124Z',
  CLOUDFLARE_EXTRACTION_STAGING_PROOF_SHA:
    '3678faa25bf3f2277f15d04b84975832c1ed6815bd9ac684a61b1917f2aae816',
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
})
