import { test, expect } from '@playwright/test'

// Landing should not host the upload widget any longer.
// Upload happens after registration on /app.
test.describe('Landing — no upload widget', () => {
  test('renders no file input on /', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('input[type="file"]')).toHaveCount(0)
  })

  test('shows a single h1 introducing the converter', async ({ page }) => {
    await page.goto('/')
    const h1s = page.getByRole('heading', { level: 1 })
    await expect(h1s).toHaveCount(1)
    await expect(h1s.first()).toContainText(/PDF bank statements/i)
  })

  test('does not render a Choose PDF button on the landing', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Choose PDF/i })).toHaveCount(0)
  })
})
