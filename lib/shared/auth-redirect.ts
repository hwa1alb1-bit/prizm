export function normalizeSiteUrl(siteUrl: string | undefined, fallbackOrigin: string): string {
  const rawUrl = siteUrl?.trim() || fallbackOrigin.trim()
  const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
  return withProtocol.replace(/\/+$/, '')
}

export function buildAuthCallbackUrl({
  siteUrl,
  fallbackOrigin,
  next,
}: {
  siteUrl: string | undefined
  fallbackOrigin: string
  next?: string
}): string {
  const callbackUrl = new URL('/auth/callback', `${normalizeSiteUrl(siteUrl, fallbackOrigin)}/`)

  if (next) {
    callbackUrl.searchParams.set('next', next)
  }

  return callbackUrl.toString()
}

export function normalizeAuthNextPath(next: string | null | undefined): string | undefined {
  const trimmed = next?.trim()
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) return undefined
  return trimmed
}
