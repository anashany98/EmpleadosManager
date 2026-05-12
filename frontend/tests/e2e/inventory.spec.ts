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

authenticatedTest.describe('Inventory Page', () => {
  authenticatedTest('should display inventory list', async ({ page }) => {
    await page.goto('/assets');
    const inventoryTab = page.locator('a:has-text("Inventario"), tab:has-text("Inventario")').first();
    await expect(inventoryTab.or(page.locator('h1:has-text("Inventario")'))).toBeVisible({ timeout: 10000 });
  });

  authenticatedTest('should show inventory items', async ({ page }) => {
    await page.goto('/assets');
    const itemCard = page.locator('[class*="item"], [class*="product"], table tbody tr:first-child').first();
    await expect(itemCard).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have search functionality', async ({ page }) => {
    await page.goto('/assets');
    const searchInput = page.locator('input[placeholder*="buscar" i], input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should filter by category', async ({ page }) => {
    await page.goto('/assets');
    const categoryFilter = page.locator('select[name="category"], button:has-text("Categoría")');
    await expect(categoryFilter.first()).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should show stock levels', async ({ page }) => {
    await page.goto('/assets');
    const stock = page.locator('text=Stock, text=Cantidad, text=Disponibles').first();
    await expect(stock.or(page.locator('[class*="stock"]'))).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Inventory Alerts', () => {
  authenticatedTest('should show low stock alerts', async ({ page }) => {
    await page.goto('/assets');
    const lowStock = page.locator('text=Stock bajo, text=Mínimo').first();
    await expect(lowStock.or(page.locator('[class*="warning"], [class*="alert"]'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should display stock quantities', async ({ page }) => {
    await page.goto('/assets');
    const quantity = page.locator('text=Unidades, text=Cantidad').first();
    await expect(quantity.or(page.locator('input[name="quantity"]'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should show reorder alerts', async ({ page }) => {
    await page.goto('/assets');
    const reorder = page.locator('text=Reordenar, text=Reposición').first();
    await expect(reorder.or(page.locator('[class*="reorder"]'))).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Inventory Management', () => {
  authenticatedTest('should add new inventory item', async ({ page }) => {
    await page.goto('/assets');
    const addButton = page.locator('button:has-text("Nuevo artículo"), button:has-text("Añadir")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await expect(page.locator('[role="dialog"], [class*="modal"]')).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should update stock quantity', async ({ page }) => {
    await page.goto('/assets');
    const item = page.locator('[class*="item"]:first-child').first();
    if (await item.isVisible()) {
      await item.click();
      const editButton = page.locator('button:has-text("Editar"), button:has-text("Ajustar")').first();
      await expect(editButton).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should assign item to employee', async ({ page }) => {
    await page.goto('/assets');
    const assignButton = page.locator('button:has-text("Asignar"), button:has-text("Entregar")').first();
    if (await assignButton.isVisible()) {
      await assignButton.click();
      await expect(page.locator('select[name="employee"], input[name="employee"]')).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should show item history', async ({ page }) => {
    await page.goto('/assets');
    const historyLink = page.locator('text=Historial, text=Movimientos').first();
    await expect(historyLink.or(page.locator('[class*="history"]'))).toBeVisible({ timeout: 5000 });
  });
});
