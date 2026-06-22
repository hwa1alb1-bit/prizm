import 'server-only'

export function normalizeOpsAdminEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const normalized = email.trim().toLowerCase()
  return normalized ? normalized : null
}

export function getOpsAdminEmailAllowlist(
  rawAllowlist = process.env.OPS_ADMIN_EMAIL_ALLOWLIST,
): ReadonlySet<string> {
  return new Set(
    (rawAllowlist ?? '')
      .split(',')
      .map((entry) => normalizeOpsAdminEmail(entry))
      .filter((entry): entry is string => Boolean(entry)),
  )
}

export function isOpsAdminEmailAllowlisted(
  email: string,
  allowlist = getOpsAdminEmailAllowlist(),
): boolean {
  return allowlist.has(email)
}
