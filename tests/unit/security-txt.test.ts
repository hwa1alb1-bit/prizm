import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const securityTxt = readFileSync(
  join(process.cwd(), 'public', '.well-known', 'security.txt'),
  'utf-8',
)

describe('public/.well-known/security.txt', () => {
  it('declares a security contact, canonical URL, and unexpired Expires per RFC 9116', () => {
    expect(securityTxt).toMatch(/^Contact:\s+mailto:.+@.+/m)
    expect(securityTxt).toMatch(
      /^Canonical:\s+https:\/\/pdftoexcelstatementconverter\.com\/\.well-known\/security\.txt/m,
    )

    const expiresMatch = securityTxt.match(/^Expires:\s+(\S+)/m)
    expect(expiresMatch).not.toBeNull()
    const expiresAt = new Date(expiresMatch![1]).getTime()
    expect(Number.isFinite(expiresAt)).toBe(true)
    expect(expiresAt).toBeGreaterThan(Date.now())
  })

  it('points to a policy URL the marketing site actually serves', () => {
    expect(securityTxt).toMatch(/^Policy:\s+https:\/\/pdftoexcelstatementconverter\.com\/security/m)
  })

  it('declares the language so localized researchers know what to expect', () => {
    expect(securityTxt).toMatch(/^Preferred-Languages:\s+\w+/m)
  })
})
