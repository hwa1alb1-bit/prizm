import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  cloudflareR2CorsUrl,
  diffCorsConfig,
  extractCorsConfig,
  normalizeCorsConfig,
  resolveCloudflareEnv,
} from '../../scripts/verify-r2-cors'

describe('R2 CORS verification script', () => {
  it('is wired into package scripts and the apply workflow', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    const workflow = readFileSync(
      join(process.cwd(), '.github/workflows/apply-r2-cors.yml'),
      'utf8',
    )

    expect(packageJson.scripts?.['verify:r2-cors']).toBe('tsx scripts/verify-r2-cors.ts')
    expect(workflow).toContain('Verify R2 CORS drift')
    expect(workflow).toContain('pnpm verify:r2-cors')
  })

  it('normalizes CORS policy order before comparing Cloudflare state', () => {
    const expected = {
      rules: [
        {
          allowed: {
            origins: ['https://prizmview.app', 'https://www.prizmview.app'],
            methods: ['PUT', 'HEAD', 'GET'],
            headers: ['*'],
          },
          exposeHeaders: ['ETag'],
          maxAgeSeconds: 3000,
        },
      ],
    }
    const actual = {
      rules: [
        {
          allowed: {
            origins: ['https://www.prizmview.app', 'https://prizmview.app'],
            methods: ['get', 'put', 'head'],
            headers: ['*'],
          },
          exposeHeaders: ['etag'],
          maxAgeSeconds: 3000,
        },
      ],
    }

    expect(normalizeCorsConfig(expected)).toEqual(normalizeCorsConfig(actual))
    expect(diffCorsConfig(expected, actual)).toEqual([])
  })

  it('reports missing production origins as drift', () => {
    const diffs = diffCorsConfig(
      {
        rules: [
          {
            allowed: {
              origins: ['https://prizmview.app', 'https://www.prizmview.app'],
              methods: ['PUT'],
              headers: ['*'],
            },
            exposeHeaders: ['ETag'],
            maxAgeSeconds: 3000,
          },
        ],
      },
      {
        rules: [
          {
            allowed: {
              origins: ['https://www.prizmview.app'],
              methods: ['PUT'],
              headers: ['*'],
            },
            exposeHeaders: ['ETag'],
            maxAgeSeconds: 3000,
          },
        ],
      },
    )

    expect(diffs).toEqual([
      'rules[0].allowed.origins expected ["https://prizmview.app","https://www.prizmview.app"], got ["https://www.prizmview.app"]',
    ])
  })

  it('extracts the wrapped Cloudflare API CORS response', () => {
    expect(
      extractCorsConfig({
        success: true,
        result: {
          rules: [
            {
              allowed: {
                origins: ['https://prizmview.app'],
                methods: ['PUT'],
                headers: ['*'],
              },
            },
          ],
        },
      }),
    ).toEqual({
      rules: [
        {
          allowed: {
            origins: ['https://prizmview.app'],
            methods: ['PUT'],
            headers: ['*'],
          },
        },
      ],
    })
  })

  it('accepts either Cloudflare or R2 account env naming', () => {
    expect(
      resolveCloudflareEnv({
        CLOUDFLARE_API_TOKEN: 'token',
        R2_ACCOUNT_ID: 'account',
        R2_UPLOAD_BUCKET: 'bucket',
      }),
    ).toEqual({
      accountId: 'account',
      bucketName: 'bucket',
      token: 'token',
    })
    expect(cloudflareR2CorsUrl('account', 'bucket/name')).toBe(
      'https://api.cloudflare.com/client/v4/accounts/account/r2/buckets/bucket%2Fname/cors',
    )
  })
})
