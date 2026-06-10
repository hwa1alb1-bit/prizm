import { expect, test } from '@playwright/test'

const pages = [
  { path: '/', heading: 'Convert Bank Statements to Excel, CSV, or Google Sheets' },
  { path: '/bank-statement-converter', heading: 'Bank Statement Converter for Excel and CSV' },
  { path: '/bank-statement-to-excel', heading: 'Convert PDF Bank Statements to Excel' },
  { path: '/bank-statement-to-csv', heading: 'Convert Bank Statements to CSV' },
  {
    path: '/convert-scanned-bank-statements',
    heading: 'Convert Scanned Bank Statements Into Spreadsheet Data',
  },
  { path: '/faq/bank-statement-conversion', heading: 'Bank Statement Conversion FAQ' },
]

for (const pageData of pages) {
  test(`${pageData.path} publishes SEO page metadata and JSON-LD`, async ({ page }) => {
    await page.goto(pageData.path)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(pageData.heading)
    await expect(page.locator('meta[name="description"]')).toHaveCount(1)

    const jsonLdCount = await page.locator('script[type="application/ld+json"]').count()
    expect(jsonLdCount).toBeGreaterThan(0)
  })
}

test('sitemap and robots resolve', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.ok()).toBe(true)
  await expect(sitemap.text()).resolves.toContain('/bank-statement-to-excel')

  const robots = await request.get('/robots.txt')
  expect(robots.ok()).toBe(true)
  await expect(robots.text()).resolves.toContain(
    'Sitemap: https://pdftoexcelstatementconverter.com/sitemap.xml',
  )
})
