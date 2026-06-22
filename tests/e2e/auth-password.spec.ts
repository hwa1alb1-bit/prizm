import { test, expect } from '@playwright/test'

// Smoke that the four auth screens render the new password-based UX.
// Live signUp / signInWithPassword / resetPasswordForEmail flows are
// covered in unit tests with mocked Supabase clients.
test.describe('Auth password screens', () => {
  test('/login shows email + password + forgot-password affordances', async ({ page }) => {
    await page.goto('/login')
    await expect(
      page.getByRole('heading', { level: 1, name: /Sign in to StatementStudio/i }),
    ).toBeVisible()
    await expect(page.getByLabel(/^Email$/)).toBeVisible()
    await expect(page.getByLabel(/^Password$/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Forgot password\?/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    await expect(page.getByRole('link', { name: /Set your password/i })).toHaveAttribute(
      'href',
      '/forgot-password?firstTime=1',
    )
  })

  test('/register shows email + password + policy hint', async ({ page }) => {
    await page.goto('/register')
    await expect(
      page.getByRole('heading', { level: 1, name: /Create your StatementStudio account/i }),
    ).toBeVisible()
    await expect(page.getByLabel(/Work email/i)).toBeVisible()
    await expect(page.getByLabel(/^Password$/)).toBeVisible()
    await expect(page.getByText(/10\+ characters/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Create account/i })).toBeVisible()
  })

  test('/forgot-password shows the request form', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(
      page.getByRole('heading', { level: 1, name: /Reset your password/i }),
    ).toBeVisible()
    await expect(page.getByLabel(/^Email$/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Send reset link/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Back to sign in/i })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  test('/forgot-password?firstTime=1 shows the set-your-password copy', async ({ page }) => {
    await page.goto('/forgot-password?firstTime=1')
    await expect(page.getByRole('heading', { level: 1, name: /Set your password/i })).toBeVisible()
    await expect(page.getByText(/finish your account setup/i)).toBeVisible()
  })

  test('/reset shows the expired-link state when there is no recovery session', async ({
    page,
  }) => {
    await page.goto('/reset')
    await expect(
      page.getByRole('heading', { name: /Reset link expired or invalid/i }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /Request a new reset link/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  test('no magic-link copy remains on the user-facing auth screens', async ({ page }) => {
    for (const path of ['/login', '/register', '/forgot-password']) {
      await page.goto(path)
      await expect(page.getByText(/magic link/i)).toHaveCount(0)
      await expect(page.getByText(/Send magic/i)).toHaveCount(0)
    }
  })

  test('/auth/confirm with no token_hash redirects to login with error', async ({ page }) => {
    const response = await page.goto('/auth/confirm?type=recovery&next=/reset')
    expect(response?.url()).toMatch(/\/login\?error=auth_callback_failed/)
  })

  test('/auth/confirm with invalid type redirects to login with error', async ({ page }) => {
    const response = await page.goto('/auth/confirm?token_hash=anything&type=bogus&next=/reset')
    expect(response?.url()).toMatch(/\/login\?error=auth_callback_failed/)
  })

  test('/auth/confirm with a bad token_hash surfaces verifyOtp error description', async ({
    page,
  }) => {
    const response = await page.goto(
      '/auth/confirm?token_hash=clearlyinvalidtokenhashvalue&type=recovery&next=/reset',
    )
    const finalUrl = response?.url() ?? ''
    expect(finalUrl).toMatch(/\/login\?error=auth_callback_failed/)
    expect(finalUrl).toMatch(/error_description=/)
  })
})
