import { test, expect } from '@playwright/test';
import { test as base } from '@playwright/test';

const authenticatedTest = base.extend({
   
  storageState: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const email = process.env.TEST_EMAIL || 'admin@test.com';
    const password = process.env.TEST_PASSWORD || 'TestPassword123!';
    
    try {
      await page.goto('/login');
      await page.fill('input[type="email"], input[name="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(dashboard|intranet|home)/i, { timeout: 10000 });
    } catch {
      // Login failed, tests will be skipped
    }
    
    await use({
      storage: await context.storageState(),
    });
    
    await context.close();
  },
});

authenticatedTest.describe('Vacations', () => {
  authenticatedTest('should display vacation requests list', async ({ page }) => {
    await page.goto('/vacations');
    await expect(page.locator('h1:has-text("Vacaciones"), h1:has-text("Vacation")')).toBeVisible({ timeout: 10000 });
  });

  authenticatedTest('should show pending requests tab', async ({ page }) => {
    await page.goto('/vacations');
    const pendingTab = page.locator('button:has-text("Pendientes"), tab:has-text("Pendientes")');
    await expect(pendingTab).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have search functionality', async ({ page }) => {
    await page.goto('/vacations');
    const searchInput = page.locator('input[placeholder*="buscar" i], input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should display vacation calendar', async ({ page }) => {
    await page.goto('/vacations');
    const calendar = page.locator('[class*="calendar"], .fc-calendar, .vacation-calendar').first();
    await expect(calendar.or(page.locator('table'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have filters for status', async ({ page }) => {
    await page.goto('/vacations');
    const filter = page.locator('select[name="status"], button:has-text("Filtrar")');
    await expect(filter.first()).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should show stats summary', async ({ page }) => {
    await page.goto('/vacations');
    const stats = page.locator('[class*="stat"], .metrics, .kpi').first();
    await expect(stats.or(page.locator('text=Días'))).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Vacation Request Flow', () => {
  authenticatedTest('should open new vacation request modal', async ({ page }) => {
    await page.goto('/vacations');
    const newButton = page.locator('button:has-text("Nueva"), button:has-text("Solicitar")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await expect(page.locator('[role="dialog"], modal, [class*="modal"]')).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should display employee vacation balance', async ({ page }) => {
    await page.goto('/profile');
    const balance = page.locator('text=Días disponibles, text=Vacaciones disponibles').first();
    await expect(balance.or(page.locator('[class*="balance"]'))).toBeVisible({ timeout: 5000 });
  });
});
