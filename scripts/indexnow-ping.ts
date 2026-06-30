#!/usr/bin/env tsx
/**
 * CLI entrypoint for IndexNow submission. Called from the
 * `promote-production.yml` workflow after Vercel alias binding succeeds.
 *
 *   pnpm tsx scripts/indexnow-ping.ts
 *
 * Exits 0 on success, 1 on failure. Logs the response status + URL count.
 */
import { submitToIndexNow } from '@/lib/marketing/indexnow'

async function main() {
  try {
    const result = await submitToIndexNow()
    console.log(
      `IndexNow: submitted ${result.submitted} URLs, status ${result.status}, ok=${result.ok}`,
    )
    process.exit(result.ok ? 0 : 1)
  } catch (error) {
    console.error('IndexNow submission failed:', error)
    process.exit(1)
  }
}

main()
