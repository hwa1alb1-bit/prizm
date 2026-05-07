import { describe, expect, it } from 'vitest'
import { PROVIDER_DEFINITIONS } from '@/lib/server/ops/providers'

describe('ops provider definitions', () => {
  it('does not require planned management API credentials until adapters use them', () => {
    const requiredKeys = PROVIDER_DEFINITIONS.flatMap((provider) => provider.requiredEnv)

    expect(requiredKeys).not.toEqual(
      expect.arrayContaining([
        'CLOUDFLARE_API_TOKEN',
        'CLOUDFLARE_ZONE_ID',
        'VERCEL_ACCESS_TOKEN',
        'AWS_SES_INBOUND_BUCKET',
      ]),
    )
  })
})
