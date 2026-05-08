import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type VercelCron = {
  path: string
  schedule: string
}

const hobbyDailySchedule = /^([0-5]?\d) ([01]?\d|2[0-3]) \* \* \*$/

describe('Vercel deployment config', () => {
  it('keeps CI and Vercel on the same Node and pnpm major versions', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as {
      engines?: { node?: string; pnpm?: string }
      packageManager?: string
    }
    const ci = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8')

    expect(packageJson.engines?.node).toBe('24.x')
    expect(packageJson.packageManager).toMatch(/^pnpm@10\./)
    expect(ci).toContain("NODE_VERSION: '24'")
    expect(ci).not.toContain('PNPM_VERSION')
    expect(ci).not.toContain('version: ${{ env.PNPM_VERSION }}')
  })

  it('keeps cron schedules compatible with Hobby deployments', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons?: VercelCron[]
    }

    const invalidCrons = (config.crons ?? []).filter(
      (cron) => !hobbyDailySchedule.test(cron.schedule),
    )

    expect(invalidCrons).toEqual([])
  })

  it('schedules document processing polling in production', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons?: VercelCron[]
    }

    expect(config.crons?.map((cron) => cron.path)).toContain('/api/ops/processing')
  })

  it('allows browser uploads to presigned S3 endpoints in the content security policy', () => {
    const nextConfig = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf8')

    expect(nextConfig).toContain('https://*.s3.amazonaws.com')
    expect(nextConfig).toContain('https://s3.amazonaws.com')
  })

  it('uses the Next proxy file convention instead of deprecated middleware', () => {
    const root = process.cwd()
    const proxyPath = resolve(root, 'proxy.ts')

    expect(existsSync(resolve(root, 'middleware.ts'))).toBe(false)
    expect(existsSync(proxyPath)).toBe(true)
    expect(readFileSync(proxyPath, 'utf8')).toContain('export async function proxy')
  })

  it('runs deletion before processing to avoid immediately scrubbing fresh conversions', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons?: VercelCron[]
    }
    const byPath = new Map(
      (config.crons ?? []).map((cron) => [cron.path, minuteOfDay(cron.schedule)]),
    )

    expect(byPath.get('/api/ops/deletion/sweep')).toBeLessThan(
      byPath.get('/api/ops/processing') ?? Number.POSITIVE_INFINITY,
    )
    expect(byPath.get('/api/ops/deletion/monitor')).toBeLessThan(
      byPath.get('/api/ops/processing') ?? Number.POSITIVE_INFINITY,
    )
  })
})

function minuteOfDay(schedule: string): number {
  const [minute, hour] = schedule.split(' ').map(Number)
  return hour * 60 + minute
}
