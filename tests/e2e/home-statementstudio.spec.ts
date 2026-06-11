import { test, expect } from '@playwright/test'

test.describe('Home — StatementStudio', () => {
  test('exposes the upload entry funnel with anchors and pricing', async ({ page }) => {
    await page.goto('/')

    // Header: wordmark + Login + Register
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible()

    // Hero: H1 + dropzone + Choose PDF button
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Turn PDF Statements/i)
    await expect(page.getByRole('button', { name: /Choose PDF/i })).toBeVisible()

    // Anchor link to pricing exists
    const pricingAnchor = page.getByRole('link', { name: 'Pricing' }).first()
    await expect(pricingAnchor).toHaveAttribute('href', '#pricing')

    // Pricing section shows real Stripe prices
    await pricingAnchor.click()
    await expect(page.getByText('$19')).toBeVisible()
    await expect(page.getByText('$49')).toBeVisible()
    await expect(page.getByText('Most popular')).toBeVisible()
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
    expect(request.url()).toContain('next=%2Fapp')
  })

  test('renders exactly one h1', async ({ page }) => {
    await page.goto('/')
    const headings = await page.getByRole('heading', { level: 1 }).count()
    expect(headings).toBe(1)
  })
})
