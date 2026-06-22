import { test, expect } from '@playwright/test'

// Smoke that the AppHeader renders on marketing routes with the right CTAs
// for the unauthenticated visitor. Authenticated state is covered in unit
// tests with the AppHeader rendered directly via React Testing Library.
test.describe('AppHeader on marketing routes', () => {
  test('/ renders the banner with Login + Register and a logo link to /', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('banner')).toBeVisible()
    const logo = page.getByRole('link', { name: /StatementStudio home/i })
    await expect(logo).toBeVisible()
    await expect(logo).toHaveAttribute('href', '/')
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Account' })).toHaveCount(0)
  })

  test('clicking the logo from / stays on /', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /StatementStudio home/i }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('/login does not render the marketing AppHeader (auth shell)', async ({ page }) => {
    await page.goto('/login')
    // The auth layout intentionally avoids the marketing banner.
    // We assert the absence of the Login link as a proxy: it sits in the AppHeader
    // and would conflict with the page's own primary action.
    const banners = await page.getByRole('banner').count()
    expect(banners).toBe(0)
  })
})
