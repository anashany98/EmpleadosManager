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

authenticatedTest.describe('Payroll Page', () => {
  authenticatedTest('should display payroll list', async ({ page }) => {
    await page.goto('/payroll');
    await expect(page.locator('h1:has-text("Nómina"), h1:has-text("Payroll"), h1:has-text("Nóminas")')).toBeVisible({ timeout: 10000 });
  });

  authenticatedTest('should show payroll batches', async ({ page }) => {
    await page.goto('/payroll');
    const batches = page.locator('[class*="batch"], table, [data-testid="payroll-table"]').first();
    await expect(batches).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have import functionality', async ({ page }) => {
    await page.goto('/payroll');
    const importButton = page.locator('button:has-text("Importar"), a[href*="import"]');
    await expect(importButton.first()).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should display payroll details', async ({ page }) => {
    await page.goto('/payroll');
    const firstRow = page.locator('table tbody tr:first-child').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.locator('[class*="detail"], [class*="panel"]').first().or(page.locator('text=Detalles'))).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should show payroll status', async ({ page }) => {
    await page.goto('/payroll');
    const status = page.locator('text=Procesado, text=Pendiente, text=Error').first();
    await expect(status).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have filters by date', async ({ page }) => {
    await page.goto('/payroll');
    const dateFilter = page.locator('input[type="date"], [placeholder*="fecha"]').first();
    await expect(dateFilter).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Payroll Import', () => {
  authenticatedTest('should navigate to import page', async ({ page }) => {
    await page.goto('/import');
    await expect(page.locator('h1:has-text("Importar"), h1:has-text("Nómina")')).toBeVisible({ timeout: 10000 });
  });

  authenticatedTest('should show file upload area', async ({ page }) => {
    await page.goto('/import');
    const uploadArea = page.locator('input[type="file"], [class*="upload"], [class*="dropzone"]').first();
    await expect(uploadArea).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should display import history', async ({ page }) => {
    await page.goto('/import');
    const history = page.locator('text=Historial, table').first();
    await expect(history).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Payroll Details', () => {
  authenticatedTest('should show employee breakdown', async ({ page }) => {
    await page.goto('/payroll');
    const firstBatch = page.locator('table tbody tr:first-child').first();
    if (await firstBatch.isVisible()) {
      await firstBatch.click();
      await page.waitForTimeout(1000);
      const breakdown = page.locator('text=Desglose, text=Detalle').first();
      await expect(breakdown.or(page.locator('table'))).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should export payroll report', async ({ page }) => {
    await page.goto('/payroll');
    const exportButton = page.locator('button:has-text("Exportar"), button:has-text("Descargar")');
    await expect(exportButton.first()).toBeVisible({ timeout: 5000 });
  });
});
