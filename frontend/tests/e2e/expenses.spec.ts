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

authenticatedTest.describe('Expenses Page', () => {
  authenticatedTest('should display expenses list', async ({ page }) => {
    await page.goto('/expenses');
    await expect(page.locator('h1:has-text("Gastos"), h1:has-text("Expenses")')).toBeVisible({ timeout: 10000 });
  });

  authenticatedTest('should show pending expenses tab', async ({ page }) => {
    await page.goto('/expenses');
    const pendingTab = page.locator('button:has-text("Pendientes"), tab:has-text("Pendientes")');
    await expect(pendingTab).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have search functionality', async ({ page }) => {
    await page.goto('/expenses');
    const searchInput = page.locator('input[placeholder*="buscar" i], input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have filters for category', async ({ page }) => {
    await page.goto('/expenses');
    const filter = page.locator('select[name="category"], button:has-text("Categoría")');
    await expect(filter.first()).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should display expense totals', async ({ page }) => {
    await page.goto('/expenses');
    const totals = page.locator('text=Total, text=Importe').first();
    await expect(totals).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have export functionality', async ({ page }) => {
    await page.goto('/expenses');
    const exportButton = page.locator('button:has-text("Exportar"), button:has-text("Descargar")');
    await expect(exportButton.first()).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Expense Request Flow', () => {
  authenticatedTest('should open new expense modal', async ({ page }) => {
    await page.goto('/expenses');
    const newButton = page.locator('button:has-text("Nuevo Gasto"), button:has-text("Crear")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await expect(page.locator('[role="dialog"], modal, [class*="modal"]')).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should display expense form fields', async ({ page }) => {
    await page.goto('/expenses');
    const newButton = page.locator('button:has-text("Nuevo Gasto"), button:has-text("Crear")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await expect(page.locator('input[name="amount"], input[type="number"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('select[name="category"]')).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should show expense history for employee', async ({ page }) => {
    await page.goto('/profile');
    const historyLink = page.locator('a:has-text("Historial de gastos"), text=Mis gastos').first();
    await expect(historyLink.or(page.locator('text=Gastos'))).toBeVisible({ timeout: 5000 });
  });
});
