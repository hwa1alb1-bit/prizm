import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('ops cron configuration', () => {
  it('schedules the SOC 2 evidence export on a daily-compatible cron', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons: Array<{ path: string; schedule: string }>
    }

    expect(config.crons).toContainEqual({
      path: '/api/ops/evidence/export',
      schedule: '0 9 * * *',
    })
  })
})
