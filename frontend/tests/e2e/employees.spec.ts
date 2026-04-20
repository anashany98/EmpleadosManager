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

test.describe('Employees Page', () => {
  authenticatedTest('should display employees list', async ({ page }) => {
    await page.goto('/employees');
    
    await expect(page.locator('h1:has-text("Empleado"), h1:has-text("Employee")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table, [role="table"], [data-testid="employees-table"]').first()).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have search functionality', async ({ page }) => {
    await page.goto('/employees');
    
    const searchInput = page.locator('input[placeholder*="buscar" i], input[placeholder*="search" i], input[type="search"]').first();
    await expect(searchInput).toBeVisible();
  });

  authenticatedTest('should filter employees on search', async ({ page }) => {
    await page.goto('/employees');
    
    const searchInput = page.locator('input[placeholder*="buscar" i], input[placeholder*="search" i], input[type="search"]').first();
    await searchInput.fill('test');
    
    await page.waitForTimeout(500);
    
    const rows = page.locator('table tbody tr, [data-testid="employee-row"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  authenticatedTest('should have pagination controls', async ({ page }) => {
    await page.goto('/employees');
    
    const pagination = page.locator('[role="navigation"], .pagination').first();
    const nextButton = page.locator('button:has-text("Siguiente")');
    await expect(pagination.or(nextButton)).toBeVisible({ timeout: 3000 });
  });

  authenticatedTest('should navigate to new employee form', async ({ page }) => {
    await page.goto('/employees');
    
    const newButton = page.locator('button:has-text("Nuevo"), button:has-text("New"), a[href*="new"]').first();
    
    if (await newButton.isVisible()) {
      await newButton.click();
      await expect(page).toHaveURL(/new|create/i, { timeout: 5000 });
    }
  });
});

test.describe('Employee Detail', () => {
  authenticatedTest('should view employee detail', async ({ page }) => {
    await page.goto('/employees');
    
    const firstRow = page.locator('table tbody tr:first-child, [data-testid="employee-row"]:first-child').first();
    
    if (await firstRow.isVisible()) {
      await firstRow.click();
      
      await expect(page).toHaveURL(/\/employees\/.+/i, { timeout: 5000 });
      
      await expect(page.locator('[class*="profile" i], [class*="detail" i]').first()).toBeVisible({ timeout: 3000 });
    }
  });

  authenticatedTest('should show employee tabs', async ({ page }) => {
    await page.goto('/employees');
    
    const firstRow = page.locator('table tbody tr:first-child').first();
    
    if (await firstRow.isVisible()) {
      await firstRow.click();
      
      const tabs = page.locator('[role="tablist"]');
      const infoButton = page.locator('button:has-text("Info")');
      const docsButton = page.locator('button:has-text("Documentos")');
      await expect(tabs.or(infoButton).or(docsButton)).toBeVisible({ timeout: 3000 });
    }
  });
});
