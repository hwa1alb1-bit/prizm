import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('privacy manifest', () => {
  it('links only to implemented public trust surfaces and privacy request routes', () => {
    const manifest = JSON.parse(
      readFileSync(path.join(repoRoot, 'public', '.well-known', 'privacy-manifest.json'), 'utf8'),
    ) as {
      $schema: string
      policy_url: string
      subprocessors_url: string
      user_rights: Record<string, string>
      last_updated: string
    }

    expect(manifest.last_updated).toBe('2026-05-05')
    expect(existsSync(publicAssetPath(manifest.$schema))).toBe(true)
    expect(existsSync(appPagePath(manifest.policy_url))).toBe(true)
    expect(existsSync(appPagePath(manifest.subprocessors_url))).toBe(true)
    expect(existsSync(routePath('/api/v1/account/data-export'))).toBe(true)
    expect(existsSync(routePath('/api/v1/account/delete'))).toBe(true)
    expect(manifest.user_rights.access).toContain('POST /api/v1/account/data-export')
    expect(manifest.user_rights.deletion).toContain('POST /api/v1/account/delete')
  })
})

function appPagePath(url: string): string {
  const pathname = new URL(url).pathname
  return path.join(repoRoot, 'app', ...pathname.split('/').filter(Boolean), 'page.tsx')
}

function routePath(pathname: string): string {
  return path.join(repoRoot, 'app', ...pathname.split('/').filter(Boolean), 'route.ts')
}

function publicAssetPath(url: string): string {
  const pathname = new URL(url).pathname
  return path.join(repoRoot, 'public', ...pathname.split('/').filter(Boolean))
}
