import { test, expect } from '@playwright/test'

test.describe('Home — StatementStudio', () => {
  test('exposes the header CTAs and the pricing section', async ({ page }) => {
    await page.goto('/')

    // Header: wordmark + Login + Register (no middle nav after the second rework)
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible()

    // Hero: a single H1 introducing the converter
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/PDF bank statements/i)

    // Pricing section renders on the same page with real Stripe prices
    const pricingSection = page.locator('#pricing')
    await expect(pricingSection).toBeVisible()
    await expect(pricingSection.getByText('$19')).toBeVisible()
    await expect(pricingSection.getByText('$49')).toBeVisible()
    await expect(pricingSection.getByText('Most popular')).toBeVisible()
  })

  test('renders exactly one h1', async ({ page }) => {
    await page.goto('/')
    const headings = await page.getByRole('heading', { level: 1 }).count()
    expect(headings).toBe(1)
  })
})
