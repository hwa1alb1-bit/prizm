import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type VercelCron = {
  path: string
  schedule: string
}

const hobbyDailySchedule = /^([0-5]?\d) ([01]?\d|2[0-3]) \* \* \*$/

describe('Vercel deployment config', () => {
  it('keeps cron schedules compatible with Hobby deployments', () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons?: VercelCron[]
    }

    const invalidCrons = (config.crons ?? []).filter(
      (cron) => !hobbyDailySchedule.test(cron.schedule),
    )

    expect(invalidCrons).toEqual([])
  })
})
