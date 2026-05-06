import { expect, test } from '@playwright/test'

const trustPages = [
  { path: '/security', heading: 'Security' },
  { path: '/privacy', heading: 'Privacy' },
  { path: '/terms', heading: 'Terms' },
  { path: '/status', heading: 'Status' },
  { path: '/docs/errors', heading: 'Error Responses' },
  { path: '/docs/rate-limits', heading: 'Rate Limits' },
  { path: '/security/subprocessors', heading: 'Subprocessors' },
  { path: '/security/policy', heading: 'Security Policy' },
]

for (const { path, heading } of trustPages) {
  test(`${path} publishes its trust page`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
  })
}

test('well-known privacy and security documents resolve', async ({ request }) => {
  const security = await request.get('/.well-known/security.txt')
  expect(security.ok()).toBe(true)
  await expect(security.text()).resolves.toContain('Contact: mailto:security@prizmview.app')

  const manifest = await request.get('/.well-known/privacy-manifest.json')
  expect(manifest.ok()).toBe(true)
  await expect(manifest.json()).resolves.toMatchObject({
    product: 'PRIZM',
    policy_url: 'https://prizmview.app/privacy',
    subprocessors_url: 'https://prizmview.app/security/subprocessors',
  })
})
