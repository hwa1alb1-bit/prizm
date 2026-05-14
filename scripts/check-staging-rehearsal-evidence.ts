import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { evaluateStagingRehearsalEvidence } from '@/lib/server/staging-rehearsal-evidence'

const evidencePath = process.argv[2] ?? process.env.STAGING_REHEARSAL_EVIDENCE

if (!evidencePath) {
  console.error(
    'Usage: pnpm check:staging-rehearsal-evidence docs/evidence/staging-rehearsals/<YYYY-MM-DD>/manifest.json',
  )
  process.exit(1)
}

const resolvedPath = resolve(process.cwd(), evidencePath)
const evidence = JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown
const result = evaluateStagingRehearsalEvidence(evidence)

if (result.ok) {
  console.log(`Staging rehearsal evidence passed: ${evidencePath}`)
} else {
  console.error(`Staging rehearsal evidence failed: ${evidencePath}`)
  for (const failure of result.failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}
