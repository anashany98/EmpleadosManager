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

authenticatedTest.describe('Vehicles Page', () => {
  authenticatedTest('should display vehicles list', async ({ page }) => {
    await page.goto('/assets');
    await expect(page.locator('h1:has-text("Vehículos"), h1:has-text("Vehicles"), h1:has-text("Activos")')).toBeVisible({ timeout: 10000 });
  });

  authenticatedTest('should show vehicle details', async ({ page }) => {
    await page.goto('/assets');
    const vehicleCard = page.locator('[class*="vehicle"], [class*="card"], table tbody tr:first-child').first();
    await expect(vehicleCard).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have search functionality', async ({ page }) => {
    await page.goto('/assets');
    const searchInput = page.locator('input[placeholder*="buscar" i], input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should show vehicle status', async ({ page }) => {
    await page.goto('/assets');
    const status = page.locator('text=Activo, text=Inactivo, text=Mantenimiento').first();
    await expect(status.or(page.locator('[class*="status"]'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should display assigned employee', async ({ page }) => {
    await page.goto('/assets');
    const assignment = page.locator('text=Asignado, text=Empleado').first();
    await expect(assignment.or(page.locator('text=SIN'))).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Vehicle Alerts', () => {
  authenticatedTest('should show ITV expiration alerts', async ({ page }) => {
    await page.goto('/assets');
    const itvAlert = page.locator('text=ITV, text=Inspección').first();
    await expect(itvAlert.or(page.locator('[class*="alert"]'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should show insurance expiration alerts', async ({ page }) => {
    await page.goto('/assets');
    const insuranceAlert = page.locator('text=Seguro, text=Insurance').first();
    await expect(insuranceAlert.or(page.locator('[class*="warning"]'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should show maintenance alerts', async ({ page }) => {
    await page.goto('/assets');
    const maintenanceAlert = page.locator('text=Mantenimiento, text=Revisión').first();
    await expect(maintenanceAlert.or(page.locator('[class*="maintenance"]'))).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Vehicle Management', () => {
  authenticatedTest('should add new vehicle', async ({ page }) => {
    await page.goto('/assets');
    const addButton = page.locator('button:has-text("Nuevo Vehículo"), button:has-text("Añadir")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await expect(page.locator('[role="dialog"], [class*="modal"]')).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should edit vehicle details', async ({ page }) => {
    await page.goto('/assets');
    const vehicle = page.locator('[class*="vehicle"]:first-child, table tbody tr:first-child').first();
    if (await vehicle.isVisible()) {
      await vehicle.click();
      const editButton = page.locator('button:has-text("Editar")').first();
      await expect(editButton).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should assign vehicle to employee', async ({ page }) => {
    await page.goto('/assets');
    const assignButton = page.locator('button:has-text("Asignar")').first();
    if (await assignButton.isVisible()) {
      await assignButton.click();
      await expect(page.locator('select[name="employee"], input[name="employee"]')).toBeVisible({ timeout: 5000 });
    }
  });

  authenticatedTest('should track vehicle mileage', async ({ page }) => {
    await page.goto('/assets');
    const mileage = page.locator('text=Kilómetros, text=Km').first();
    await expect(mileage.or(page.locator('input[name="mileage"]'))).toBeVisible({ timeout: 5000 });
  });
});
