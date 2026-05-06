import { pingRedis } from '@/lib/server/ratelimit'
import { pingResend } from '@/lib/server/resend'
import { pingS3 } from '@/lib/server/s3'
import { pingSentry } from '@/lib/server/sentry'
import { pingStripe } from '@/lib/server/stripe'
import { pingSupabase } from '@/lib/server/supabase'
import { pingTextract } from '@/lib/server/textract'
import { evaluateLiveConnectorSmokeGate } from '@/lib/server/launch-gates'

type Check = {
  name: string
  required: boolean
  run: () => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string }
}

const checks: Check[] = [
  { name: 'supabase', required: true, run: pingSupabase },
  { name: 'stripe', required: true, run: pingStripe },
  { name: 's3', required: true, run: pingS3 },
  { name: 'textract', required: true, run: pingTextract },
  { name: 'redis', required: true, run: pingRedis },
  { name: 'resend', required: false, run: pingResend },
  { name: 'sentry', required: false, run: () => pingSentry() },
]

async function main(): Promise<void> {
  const smokeGate = evaluateLiveConnectorSmokeGate(process.env)

  if (!smokeGate.ok) {
    console.error('Live connector smoke gate failed.')
    for (const failure of smokeGate.failures) {
      const label = failure.reason === 'missing' ? 'Missing' : 'Invalid'
      console.error(`${failure.title}: ${label} ${failure.envKeys.join(', ')}`)
    }
    process.exit(1)
  }

  const results = await Promise.all(
    checks.map(async (check) => {
      try {
        const result = await check.run()
        return { ...check, ...result }
      } catch (err) {
        return {
          ...check,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }),
  )

  for (const result of results) {
    const status = result.ok ? 'ok' : result.required ? 'failed' : 'optional-failed'
    console.log(`${result.name}: ${status}`)
  }

  const failed = results.filter((result) => result.required && !result.ok)
  if (failed.length > 0) {
    console.error(`Required connector smoke checks failed: ${failed.map((r) => r.name).join(', ')}`)
    process.exit(1)
  }
}

void main()
