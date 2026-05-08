import { describe, expect, it } from 'vitest'
import {
  buildAuthCallbackUrl,
  normalizeAuthNextPath,
  normalizeSiteUrl,
} from '@/lib/shared/auth-redirect'

describe('auth redirect URLs', () => {
  it('uses the configured production site URL over the browser origin', () => {
    expect(
      buildAuthCallbackUrl({
        siteUrl: 'https://prizmview.app',
        fallbackOrigin: 'http://localhost:3000',
      }),
    ).toBe('https://prizmview.app/auth/callback')
  })

  it('normalizes bare domains and trailing slashes', () => {
    expect(normalizeSiteUrl('prizmview.app///', 'http://localhost:3000')).toBe(
      'https://prizmview.app',
    )
  })

  it('preserves explicit next paths for scoped sign-in flows', () => {
    expect(
      buildAuthCallbackUrl({
        siteUrl: 'https://prizmview.app/',
        fallbackOrigin: 'http://localhost:3000',
        next: '/ops',
      }),
    ).toBe('https://prizmview.app/auth/callback?next=%2Fops')
  })

  it('accepts only local absolute paths as auth next targets', () => {
    expect(normalizeAuthNextPath('/app/billing')).toBe('/app/billing')
    expect(normalizeAuthNextPath(' /app/settings ')).toBe('/app/settings')
    expect(normalizeAuthNextPath('https://evil.example')).toBeUndefined()
    expect(normalizeAuthNextPath('//evil.example')).toBeUndefined()
    expect(normalizeAuthNextPath(null)).toBeUndefined()
  })
})
