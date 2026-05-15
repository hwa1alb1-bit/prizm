import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type R2CorsRule = {
  allowed?: {
    origins?: string[]
    methods?: string[]
    headers?: string[]
  }
  exposeHeaders?: string[]
  maxAgeSeconds?: number
}

type R2CorsConfig = {
  rules?: R2CorsRule[]
}

describe('Cloudflare R2 browser upload CORS policy', () => {
  const readConfig = () =>
    JSON.parse(
      readFileSync(resolve(process.cwd(), 'infra/cloudflare/r2-upload-cors.json'), 'utf8'),
    ) as R2CorsConfig

  it('tracks the Wrangler-ready CORS rule required by production browser uploads', () => {
    const config = readConfig()

    expect(config.rules).toHaveLength(1)
    const [rule] = config.rules ?? []

    expect(rule.allowed?.origins).toEqual([
      'https://prizmview.app',
      'https://www.prizmview.app',
      'https://*.vercel.app',
      'http://localhost:3030',
    ])
    expect(rule.allowed?.origins?.every((origin) => !origin.endsWith('/'))).toBe(true)
    expect(rule.allowed?.methods).toEqual(['PUT', 'GET', 'HEAD'])
    expect(rule.allowed?.headers).toEqual(['*'])
    expect(rule.exposeHeaders).toEqual(['ETag'])
    expect(rule.maxAgeSeconds).toBe(3000)
  })
})
