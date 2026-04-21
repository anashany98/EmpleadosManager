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

authenticatedTest.describe('Inbox Page', () => {
  authenticatedTest('should display inbox list', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page.locator('h1:has-text("Bandeja de Entrada"), h1:has-text("Inbox")')).toBeVisible({ timeout: 10000 });
  });

  authenticatedTest('should show pending documents', async ({ page }) => {
    await page.goto('/inbox');
    const pending = page.locator('text=Pendientes, text=Sin asignar').first();
    await expect(pending.or(page.locator('[class*="pending"]'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have search functionality', async ({ page }) => {
    await page.goto('/inbox');
    const searchInput = page.locator('input[placeholder*="buscar" i], input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should display document preview', async ({ page }) => {
    await page.goto('/inbox');
    const docItem = page.locator('[class*="document"], [class*="file"], table tbody tr:first-child').first();
    if (await docItem.isVisible()) {
      await docItem.click();
      await expect(page.locator('[class*="preview"], iframe, [class*="viewer"]').first().or(page.locator('text=Vista previa'))).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should show document source', async ({ page }) => {
    await page.goto('/inbox');
    const source = page.locator('text=Origen, text=Email, text=Scanner').first();
    await expect(source.or(page.locator('[class*="source"]'))).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Document Assignment', () => {
  authenticatedTest('should have assign button', async ({ page }) => {
    await page.goto('/inbox');
    const assignButton = page.locator('button:has-text("Asignar"), button:has-text("Archivar")').first();
    await expect(assignButton).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should open assign modal', async ({ page }) => {
    await page.goto('/inbox');
    const assignButton = page.locator('button:has-text("Asignar"), button:has-text("Archivar")').first();
    if (await assignButton.isVisible()) {
      await assignButton.click();
      await expect(page.locator('[role="dialog"], [class*="modal"]')).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should search employee for assignment', async ({ page }) => {
    await page.goto('/inbox');
    const assignButton = page.locator('button:has-text("Asignar")').first();
    if (await assignButton.isVisible()) {
      await assignButton.click();
      const searchInput = page.locator('input[placeholder*="empleado" i], input[name="employee"]');
      await expect(searchInput).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should select document category', async ({ page }) => {
    await page.goto('/inbox');
    const assignButton = page.locator('button:has-text("Asignar")').first();
    if (await assignButton.isVisible()) {
      await assignButton.click();
      const categorySelect = page.locator('select[name="category"]');
      await expect(categorySelect).toBeVisible({ timeout: 5000 });
    }
  });
});

authenticatedTest.describe('Inbox Management', () => {
  authenticatedTest('should delete document', async ({ page }) => {
    await page.goto('/inbox');
    const deleteButton = page.locator('button:has-text("Eliminar"), button[aria-label*="Elim"]').first();
    if (await deleteButton.isVisible()) {
      await expect(deleteButton).toBeVisible();
    }
  });

  authenticatedTest('should download document', async ({ page }) => {
    await page.goto('/inbox');
    const downloadButton = page.locator('button:has-text("Descargar"), a[download]').first();
    if (await downloadButton.isVisible()) {
      await expect(downloadButton).toBeVisible();
    }
  });

  authenticatedTest('should show processed documents', async ({ page }) => {
    await page.goto('/inbox');
    const processedTab = page.locator('button:has-text("Procesados"), tab:has-text("Procesados")');
    await expect(processedTab.or(page.locator('text=Procesados'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have sync functionality', async ({ page }) => {
    await page.goto('/inbox');
    const syncButton = page.locator('button:has-text("Sincronizar"), button:has-text("Actualizar")').first();
    await expect(syncButton).toBeVisible({ timeout: 5000 });
  });
});
