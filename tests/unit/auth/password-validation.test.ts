import { describe, expect, it } from 'vitest'
import { validatePassword } from '@/lib/auth/password'

describe('validatePassword', () => {
  it('accepts a 10+ character password with upper, lower, and a digit', () => {
    expect(validatePassword('Hunter12345')).toEqual({ ok: true })
  })

  it('rejects an empty string', () => {
    const result = validatePassword('')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/required/i)
  })

  it('rejects a password shorter than 10 characters', () => {
    const result = validatePassword('Hunter1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/10/)
  })

  it('rejects a password with no uppercase letter', () => {
    const result = validatePassword('hunter12345')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/upper/i)
  })

  it('rejects a password with no lowercase letter', () => {
    const result = validatePassword('HUNTER12345')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/lower/i)
  })

  it('rejects a password with no digit', () => {
    const result = validatePassword('HunterPassword')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/number|digit/i)
  })

  it('rejects whitespace-only input as not meeting any character requirement', () => {
    const result = validatePassword('            ')
    expect(result.ok).toBe(false)
  })
})
