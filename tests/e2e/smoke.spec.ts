import { test, expect } from '@playwright/test'

// Minimal smoke that boots the landing page and confirms the brand renders.
// Replaced by real flow tests as Wave 2 ships server actions.
test('landing page renders PRIZM branding', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Convert PDF bank statements to clean Excel and CSV.',
  )
})
