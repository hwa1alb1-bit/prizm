import { test, expect } from '@playwright/test'

// Minimal smoke that boots the landing page and confirms the brand renders.
test('landing page renders StatementStudio brand and hero', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('link', { name: /StatementStudio home|StatementStudio/i }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/PDF bank statements/i)
})
