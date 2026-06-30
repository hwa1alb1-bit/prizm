import { describe, expect, it } from 'vitest'
import robots from '@/app/robots'
import { absoluteUrl } from '@/lib/seo/site'

describe('robots', () => {
  const config = robots()
  const rules = Array.isArray(config.rules) ? config.rules : [config.rules]

  it('allows public discovery and disallows app, ops, API, and auth callback routes', () => {
    const wildcard = rules.find((rule) => rule.userAgent === '*')
    expect(wildcard).toBeDefined()
    expect(config.sitemap).toBe(absoluteUrl('/sitemap.xml'))
    expect(wildcard?.allow).toBe('/')
    expect(wildcard?.disallow).toEqual(
      expect.arrayContaining(['/app/', '/ops/', '/api/', '/auth/callback', '/auth/finish']),
    )
  })

  it('blocks well-known AI training and retrieval bots site-wide', () => {
    const required = [
      'GPTBot',
      'ChatGPT-User',
      'OAI-SearchBot',
      'ClaudeBot',
      'anthropic-ai',
      'Claude-Web',
      'PerplexityBot',
      'CCBot',
      'Google-Extended',
      'Applebot-Extended',
      'Bytespider',
      'Meta-ExternalAgent',
    ]

    for (const userAgent of required) {
      const rule = rules.find((r) => r.userAgent === userAgent)
      expect(rule, `missing AI bot rule for ${userAgent}`).toBeDefined()
      const disallow = Array.isArray(rule?.disallow) ? rule?.disallow : [rule?.disallow]
      expect(disallow).toContain('/')
    }
  })

  it('keeps Googlebot and Bingbot allowed (no per-agent override)', () => {
    expect(rules.find((rule) => rule.userAgent === 'Googlebot')).toBeUndefined()
    expect(rules.find((rule) => rule.userAgent === 'Bingbot')).toBeUndefined()
  })
})
