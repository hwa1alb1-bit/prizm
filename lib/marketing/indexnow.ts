/**
 * IndexNow integration. Submits the site's public sitemap URLs to the IndexNow
 * endpoint after a successful production deploy. Bing + Yandex consume this
 * directly; Google ignores it but harmless to call. Configured via:
 *   - public/<INDEXNOW_KEY>.txt  (must contain only the key text)
 *   - INDEXNOW_ENDPOINT          (defaults to https://api.indexnow.org/IndexNow)
 *
 * Called from the GitHub Actions `promote-production.yml` workflow on every
 * successful merge to main, after Vercel alias binding completes. See
 * scripts/indexnow-ping.ts for the CLI entrypoint.
 */
import { absoluteUrl, publicSitemapRoutes } from '@/lib/seo/site'
import { buildBankSlugs } from '@/lib/marketing/marketing-banks'
import { buildIntegrationSlugs } from '@/lib/marketing/marketing-integrations'
import { buildConvertSlugs } from '@/lib/marketing/supported-issuers'

export const INDEXNOW_KEY = 'f34946a3de0e92ea4657bb765d665076'
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow'

export function buildAllSitemapUrls(): string[] {
  const staticUrls = publicSitemapRoutes.map((route) => absoluteUrl(route))
  const bankUrls = buildBankSlugs().map((slug) => absoluteUrl(`/bank/${slug}`))
  const integrationUrls = buildIntegrationSlugs().map((slug) =>
    absoluteUrl(`/integrate/${slug}`),
  )
  const convertUrls = buildConvertSlugs().map((slug) => absoluteUrl(`/convert/${slug}`))
  return [...staticUrls, ...bankUrls, ...integrationUrls, ...convertUrls]
}

export type IndexNowSubmission = {
  host: string
  key: string
  keyLocation: string
  urlList: string[]
}

export function buildIndexNowSubmission(urls: string[] = buildAllSitemapUrls()): IndexNowSubmission {
  if (urls.length === 0) throw new Error('indexnow_empty_url_list')
  const host = new URL(urls[0]).host
  return {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  }
}

export async function submitToIndexNow(
  urls: string[] = buildAllSitemapUrls(),
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; submitted: number }> {
  const submission = buildIndexNowSubmission(urls)
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(submission),
  })
  return { ok: response.ok, status: response.status, submitted: submission.urlList.length }
}
