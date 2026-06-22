import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const SCAN_DIRS = ['app', 'components', 'lib/seo', 'lib/server']
const FILE_EXT = /\.(ts|tsx|mdx)$/
const SKIP_FILE = /\.test\.(ts|tsx)$/
// Env-var names and other deployment-time identifiers that keep the old codename.
const ALLOWED_PRIZM_TOKENS = /PRIZM_EXTRACTION_ENGINE/

function walk(dir: string, acc: string[]): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      walk(full, acc)
    } else if (FILE_EXT.test(entry) && !SKIP_FILE.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

describe('Brand sweep guard', () => {
  it('contains no PrizmView wordmark in user-facing source', () => {
    const files = SCAN_DIRS.flatMap((d) => walk(join(repoRoot, d), []))
    expect(files.length).toBeGreaterThan(0)

    const offenders: { path: string; line: number; text: string }[] = []
    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      content.split(/\r?\n/).forEach((line, index) => {
        if (line.includes('PrizmView')) {
          offenders.push({ path: relative(repoRoot, file), line: index + 1, text: line.trim() })
        }
      })
    }

    expect(
      offenders,
      `Found PrizmView wordmark in:\n${offenders.map((o) => `  ${o.path}:${o.line} -> ${o.text}`).join('\n')}`,
    ).toEqual([])
  })

  it('contains no PRIZM all-caps codename in user-facing source', () => {
    const files = SCAN_DIRS.flatMap((d) => walk(join(repoRoot, d), []))
    const wordBoundary = /\bPRIZM\b/

    const offenders: { path: string; line: number; text: string }[] = []
    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      content.split(/\r?\n/).forEach((line, index) => {
        if (wordBoundary.test(line) && !ALLOWED_PRIZM_TOKENS.test(line)) {
          offenders.push({ path: relative(repoRoot, file), line: index + 1, text: line.trim() })
        }
      })
    }

    expect(
      offenders,
      `Found PRIZM wordmark in:\n${offenders.map((o) => `  ${o.path}:${o.line} -> ${o.text}`).join('\n')}`,
    ).toEqual([])
  })
})
