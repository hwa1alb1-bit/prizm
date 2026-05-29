import { describe, expect, it } from 'vitest'
import {
  getOpsAdminEmailAllowlist,
  isOpsAdminEmailAllowlisted,
  normalizeOpsAdminEmail,
} from '@/lib/server/ops-admin-allowlist'

describe('ops admin email allowlist', () => {
  it('normalizes email addresses before allowlist checks', () => {
    expect(normalizeOpsAdminEmail(' OneOddBob@Gmail.com ')).toBe('oneoddbob@gmail.com')
  })

  it('parses comma-separated email allowlists case-insensitively', () => {
    const allowlist = getOpsAdminEmailAllowlist('OneOddBob@Gmail.com, heinrich.willem@gmail.com')

    expect(isOpsAdminEmailAllowlisted('oneoddbob@gmail.com', allowlist)).toBe(true)
    expect(isOpsAdminEmailAllowlisted('heinrich.willem@gmail.com', allowlist)).toBe(true)
    expect(isOpsAdminEmailAllowlisted('intruder@example.com', allowlist)).toBe(false)
  })
})
