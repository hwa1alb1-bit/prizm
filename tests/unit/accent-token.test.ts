import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const css = readFileSync(join(repoRoot, 'app', 'globals.css'), 'utf8')

function extractRootBlock(): string {
  const match = css.match(/:root\s*\{([^}]*)\}/)
  if (!match) throw new Error('No :root block in globals.css')
  return match[1]
}

function tokenValue(token: string): string {
  const inner = extractRootBlock()
  const rule = new RegExp(`${token}\\s*:\\s*([^;]+);`)
  return inner.match(rule)?.[1].trim().toLowerCase() ?? ''
}

describe('Light-theme hex palette', () => {
  it('uses the lavender-blue primary palette', () => {
    expect(tokenValue('--primary')).toBe('#4f46e5')
    expect(tokenValue('--primary-hover')).toBe('#4338ca')
    expect(tokenValue('--primary-active')).toBe('#3730a3')
    expect(tokenValue('--primary-soft')).toBe('#eef0ff')
  })

  it('uses the soft off-white background and surface scale', () => {
    expect(tokenValue('--background')).toBe('#fffafa')
    expect(tokenValue('--surface')).toBe('#ffffff')
    expect(tokenValue('--surface-soft')).toBe('#f8f7ff')
    expect(tokenValue('--surface-muted')).toBe('#f3f1ff')
  })

  it('uses lavender borders and navy text', () => {
    expect(tokenValue('--border')).toBe('#e4e1f5')
    expect(tokenValue('--border-strong')).toBe('#c9c2ff')
    expect(tokenValue('--text-primary')).toBe('#07122f')
    expect(tokenValue('--text-secondary')).toBe('#516079')
    expect(tokenValue('--text-muted')).toBe('#7a8499')
  })

  it('declares the semantic state colors', () => {
    expect(tokenValue('--success')).toBe('#16a34a')
    expect(tokenValue('--warning')).toBe('#f59e0b')
    expect(tokenValue('--error')).toBe('#dc2626')
  })

  it('declares the focus ring with the primary alpha', () => {
    expect(tokenValue('--focus-ring')).toMatch(/rgba\(\s*79\s*,\s*70\s*,\s*229\s*,\s*0\.28\s*\)/)
  })

  it('declares elevation, motion, and state-surface tokens', () => {
    expect(tokenValue('--elevation-card')).toMatch(/rgba/)
    expect(tokenValue('--elevation-hover')).toMatch(/rgba/)
    expect(tokenValue('--easing-out')).toMatch(/cubic-bezier/)
    expect(tokenValue('--duration-fast')).toMatch(/ms/)
    expect(tokenValue('--duration-base')).toMatch(/ms/)
    expect(tokenValue('--surface-success-soft')).toMatch(/^#[0-9a-f]{6,8}$/i)
    expect(tokenValue('--surface-danger-soft')).toMatch(/^#[0-9a-f]{6,8}$/i)
    expect(tokenValue('--surface-warning-soft')).toMatch(/^#[0-9a-f]{6,8}$/i)
  })

  it('does not declare a dark prefers-color-scheme block', () => {
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/)
  })
})
