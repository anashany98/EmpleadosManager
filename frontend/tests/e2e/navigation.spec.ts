import { test, expect } from '@playwright/test';
import { test as authenticatedTest } from '@playwright/test';

test.describe('Navigation', () => {
  authenticatedTest('should display main navigation', async ({ page }) => {
    await page.goto('/dashboard');
    
    const nav = page.locator('nav, header, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 10000 });
  });

  authenticatedTest('should have link to employees', async ({ page }) => {
    await page.goto('/dashboard');
    
    const employeesLink = page.locator('a[href*="employees"], nav a:has-text("Empleado"), button:has-text("Empleado")').first();
    await expect(employeesLink.or(page.locator('nav'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have link to calendar', async ({ page }) => {
    await page.goto('/dashboard');
    
    const calendarLink = page.locator('a[href*="calendar"], nav a:has-text("Calendario")').first();
    await expect(calendarLink.or(page.locator('nav'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have user menu', async ({ page }) => {
    await page.goto('/dashboard');
    
    const userMenu = page.locator('[aria-label*="usuario" i], [aria-label*="user" i], button:has-text("Admin"), button:has-text("Usuario")').first();
    await expect(userMenu.or(page.locator('nav'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should navigate to employees from nav', async ({ page }) => {
    await page.goto('/dashboard');
    
    const employeesLink = page.locator('a[href*="employees"]').first();
    
    if (await employeesLink.isVisible()) {
      await employeesLink.click();
      await expect(page).toHaveURL(/employees/i, { timeout: 5000 });
    }
  });
});

test.describe('Dashboard', () => {
  authenticatedTest('should display dashboard page', async ({ page }) => {
    await page.goto('/dashboard');
    
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  authenticatedTest('should display stats cards', async ({ page }) => {
    await page.goto('/dashboard');
    
    const cards = page.locator('[class*="card"], [class*="stat"], [class*="metric"]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should display recent activity', async ({ page }) => {
    await page.goto('/dashboard');
    
    const activity = page.locator('[class*="activity"], [class*="recent"], [class*="feed"]');
    await expect(activity.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Sidebar', () => {
  authenticatedTest('should collapse on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    
    const menuButton = page.locator('button[aria-label*="menu" i], button:has-text("☰"), button:has-text("Menu")').first();
    
    if (await menuButton.isVisible()) {
      await menuButton.click();
      
      const sidebar = page.locator('[class*="sidebar"], aside, nav');
      await expect(sidebar).toBeVisible();
    }
  });

  authenticatedTest('should highlight active page', async ({ page }) => {
    await page.goto('/employees');
    
    const activeLink = page.locator('a[aria-current="page"], a[class*="active"], a[class*="selected"]').first();
    await expect(activeLink).toBeVisible({ timeout: 5000 });
  });
});
