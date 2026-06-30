import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  INDEXNOW_KEY,
  buildAllSitemapUrls,
  buildIndexNowSubmission,
  submitToIndexNow,
} from '@/lib/marketing/indexnow'

describe('IndexNow', () => {
  it('the public key file at /<key>.txt matches the configured key', () => {
    const fileContents = readFileSync(
      join(process.cwd(), 'public', `${INDEXNOW_KEY}.txt`),
      'utf-8',
    ).trim()
    expect(fileContents).toBe(INDEXNOW_KEY)
  })

  it('builds a submission with host, key, keyLocation, and a non-empty urlList', () => {
    const submission = buildIndexNowSubmission()
    expect(submission.host).toMatch(/^[\w.-]+$/)
    expect(submission.key).toBe(INDEXNOW_KEY)
    expect(submission.keyLocation).toBe(`https://${submission.host}/${INDEXNOW_KEY}.txt`)
    expect(submission.urlList.length).toBeGreaterThan(0)
  })

  it('covers the full sitemap (static + bank + integrate + convert)', () => {
    const urls = buildAllSitemapUrls()
    expect(urls.some((u) => u.endsWith('/'))).toBe(true)
    expect(urls.some((u) => u.includes('/bank/'))).toBe(true)
    expect(urls.some((u) => u.includes('/integrate/'))).toBe(true)
    expect(urls.some((u) => u.includes('/convert/'))).toBe(true)
  })

  it('POSTs to the IndexNow endpoint with the submission body and reports ok on 200', async () => {
    const fetchMock = vi.fn(
      async () => new Response('', { status: 200 }),
    ) as unknown as typeof fetch
    const result = await submitToIndexNow(
      ['https://example.com/a', 'https://example.com/b'],
      fetchMock,
    )
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.submitted).toBe(2)
  })
})
