import { test, expect } from '@playwright/test'

test.describe('Home — StatementStudio', () => {
  test('exposes the upload entry funnel and the pricing section', async ({ page }) => {
    await page.goto('/')

    // Header: wordmark + Login + Register (no middle nav after the second rework)
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible()

    // Hero: H1 + dropzone + Choose PDF button
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Turn PDF Statements/i)
    await expect(page.getByRole('button', { name: /Choose PDF/i })).toBeVisible()

    // Pricing section renders on the same page with real Stripe prices
    const pricingSection = page.locator('#pricing')
    await expect(pricingSection).toBeVisible()
    await expect(pricingSection.getByText('$19')).toBeVisible()
    await expect(pricingSection.getByText('$49')).toBeVisible()
    await expect(pricingSection.getByText('Most popular')).toBeVisible()
  })

  test('routes anonymous file selection to /register', async ({ page }) => {
    await page.goto('/')

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/register')),
      page.setInputFiles('input[type="file"]', {
        name: 'sample.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 minimal'),
      }),
    ])

    expect(request.url()).toContain('/register')
    // Next.js router does not URL-encode `/` in query values, so accept either form.
    expect(request.url()).toMatch(/next=(%2F|\/)app/)
  })

  test('renders exactly one h1', async ({ page }) => {
    await page.goto('/')
    const headings = await page.getByRole('heading', { level: 1 }).count()
    expect(headings).toBe(1)
  })
})
