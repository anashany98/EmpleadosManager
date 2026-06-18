import { test, expect, type Page } from '@playwright/test';

/**
 * Login page E2E tests.
 *
 * Most tests run without credentials. The "successful login" test is
 * tagged with `test.fixme` so it appears in the report as a pending
 * test (rather than `skip` which silently passes). To run it:
 *   1. Spin up the backend (npm run dev in backend/)
 *   2. Seed an admin: `npm run seed:admin`
 *   3. Set TEST_EMAIL and TEST_PASSWORD in the environment
 *   4. Set RUN_LOGIN_TESTS=true and re-run the suite
 */

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

    /**
     * Happy-path test. Currently marked as `fixme` because it requires
     * a real backend + seeded admin user. To enable:
     *   export RUN_LOGIN_TESTS=true
     *   export TEST_EMAIL=admin@example.com
     *   export TEST_PASSWORD=TestPassword123!
     */
    test('should redirect to dashboard on successful login', async ({ page }) => {
        test.fixme(
            process.env.RUN_LOGIN_TESTS !== 'true',
            'Set RUN_LOGIN_TESTS=true with TEST_EMAIL and TEST_PASSWORD to enable'
        );

        const email = process.env.TEST_EMAIL;
        const password = process.env.TEST_PASSWORD;
        if (!email || !password) {
            test.skip(true, 'TEST_EMAIL or TEST_PASSWORD not set');
            return;
        }

        await page.fill('input[type="email"], input[name="email"]', email);
        await page.fill('input[type="password"]', password);
        await page.click('button[type="submit"]');

        // The app sets access_token (HttpOnly) + csrf_token cookies on
        // success. The AuthContext bootstraps /auth/me and either
        // redirects to / or to the originally-requested path.
        await expect(page).toHaveURL(/\/(dashboard|intranet|home|$)/i, { timeout: 15000 });
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
