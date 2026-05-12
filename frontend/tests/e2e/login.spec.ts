import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('form, [class*="login"]')).toBeVisible();
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.click('button[type="submit"]');
    
    const errorLocator = page.locator('span:has-text("obligatorio"), p:has-text("requerido"), [class*="error"]');
    await expect(errorLocator.first()).toBeVisible({ timeout: 3000 });
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.fill('input[type="email"], input[name="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=/email.*inválido|inválido.*email/i')).toBeVisible({ timeout: 3000 });
  });

  test('should show error for wrong credentials', async ({ page }) => {
    await page.fill('input[type="email"], input[name="email"]', 'nonexistent@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=/credenciales|inválido|incorrecto/i')).toBeVisible({ timeout: 5000 });
  });

  test('should redirect to dashboard on successful login', async ({ page }) => {
    // Note: This test requires valid credentials
    // Skip if no test credentials are available
    test.skip(process.env.SKIP_LOGIN_TESTS === 'true', 'Skipping login test - no test credentials');
    
    // Use environment variables for test credentials
    const email = process.env.TEST_EMAIL || 'admin@test.com';
    const password = process.env.TEST_PASSWORD || 'TestPassword123!';
    
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/(dashboard|intranet|home)/i, { timeout: 15000 });
  });
});

test.describe('Password Reset', () => {
  test('should show forgot password link', async ({ page }) => {
    await page.goto('/login');
    
    const forgotLink = page.locator('a:has-text("olvid"), a:has-text("recuperar"), a:has-text("reset")');
    await expect(forgotLink.first()).toBeVisible();
  });

  test('should navigate to reset page', async ({ page }) => {
    await page.goto('/login');
    
    await page.click('a:has-text("olvid"), a:has-text("recuperar"), a:has-text("reset")');
    
    await expect(page).toHaveURL(/reset|recuperar|forgot/i);
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  });
});
