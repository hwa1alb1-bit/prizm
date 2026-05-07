import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('security disclosure metadata', () => {
  it('does not advertise unresolved disclosure resources', () => {
    const securityTxt = readFileSync(
      path.join(repoRoot, 'public', '.well-known', 'security.txt'),
      'utf8',
    )

    expect(securityTxt).toContain('Contact: mailto:security@prizmview.app')
    expect(securityTxt).toContain('Policy: https://prizmview.app/security/policy')
    expect(securityTxt).not.toContain('/.well-known/pgp-key.txt')
    expect(securityTxt).not.toContain('/security/acknowledgments')
    expect(securityTxt).not.toContain('/careers')
    expect(existsSync(path.join(repoRoot, 'app', 'security', 'policy', 'page.tsx'))).toBe(true)
  })
})
