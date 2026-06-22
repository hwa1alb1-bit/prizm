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
        siteUrl: 'https://pdftoexcelstatementconverter.com',
        fallbackOrigin: 'http://localhost:3000',
      }),
    ).toBe('https://pdftoexcelstatementconverter.com/auth/callback')
  })

  it('normalizes bare domains and trailing slashes', () => {
    expect(normalizeSiteUrl('pdftoexcelstatementconverter.com///', 'http://localhost:3000')).toBe(
      'https://pdftoexcelstatementconverter.com',
    )
  })

  it('preserves explicit next paths for scoped sign-in flows', () => {
    expect(
      buildAuthCallbackUrl({
        siteUrl: 'https://pdftoexcelstatementconverter.com/',
        fallbackOrigin: 'http://localhost:3000',
        next: '/ops',
      }),
    ).toBe('https://pdftoexcelstatementconverter.com/auth/callback?next=%2Fops')
  })

  it('accepts only local absolute paths as auth next targets', () => {
    expect(normalizeAuthNextPath('/app/billing')).toBe('/app/billing')
    expect(normalizeAuthNextPath(' /app/settings ')).toBe('/app/settings')
    expect(normalizeAuthNextPath('https://evil.example')).toBeUndefined()
    expect(normalizeAuthNextPath('//evil.example')).toBeUndefined()
    expect(normalizeAuthNextPath(null)).toBeUndefined()
  })
})
