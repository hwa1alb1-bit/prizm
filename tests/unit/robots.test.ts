import { describe, expect, it } from 'vitest'
import robots from '@/app/robots'
import { absoluteUrl } from '@/lib/seo/site'

describe('robots', () => {
  it('allows public discovery and disallows app, ops, API, and auth callback routes', () => {
    const config = robots()
    const rule = Array.isArray(config.rules) ? config.rules[0] : config.rules

    expect(config.sitemap).toBe(absoluteUrl('/sitemap.xml'))
    expect(rule.allow).toBe('/')
    expect(rule.disallow).toEqual(
      expect.arrayContaining(['/app/', '/ops/', '/api/', '/auth/callback']),
    )
  })
})
