import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const css = readFileSync(join(repoRoot, 'app', 'globals.css'), 'utf8')

function extractRule(scope: 'light' | 'dark', token: string): string {
  if (scope === 'light') {
    const match = css.match(/:root\s*\{([^}]*)\}/)
    if (!match) throw new Error('No :root block in globals.css')
    const inner = match[1]
    const ruleRegex = new RegExp(`${token}\\s*:\\s*([^;]+);`)
    return inner.match(ruleRegex)?.[1].trim() ?? ''
  }
  const darkMatch = css.match(
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/,
  )
  if (!darkMatch) throw new Error('No dark :root block in globals.css')
  const inner = darkMatch[1]
  const ruleRegex = new RegExp(`${token}\\s*:\\s*([^;]+);`)
  return inner.match(ruleRegex)?.[1].trim() ?? ''
}

function oklchHue(value: string): number {
  const match = value.match(/oklch\(\s*[\d.]+%\s+[\d.]+\s+([\d.]+)\s*\)/)
  if (!match) throw new Error(`Could not parse OKLCH from '${value}'`)
  return Number(match[1])
}

describe('Accent token (indigo)', () => {
  it('light --accent uses an indigo hue (around 280)', () => {
    const value = extractRule('light', '--accent')
    expect(value).toMatch(/^oklch/)
    expect(oklchHue(value)).toBeGreaterThanOrEqual(265)
    expect(oklchHue(value)).toBeLessThanOrEqual(295)
  })

  it('dark --accent uses an indigo hue (around 280)', () => {
    const value = extractRule('dark', '--accent')
    expect(value).toMatch(/^oklch/)
    expect(oklchHue(value)).toBeGreaterThanOrEqual(265)
    expect(oklchHue(value)).toBeLessThanOrEqual(295)
  })

  it('keeps semantic tokens intact (success stays around hue 150)', () => {
    expect(oklchHue(extractRule('light', '--success'))).toBeGreaterThanOrEqual(140)
    expect(oklchHue(extractRule('light', '--success'))).toBeLessThanOrEqual(160)
  })
})
