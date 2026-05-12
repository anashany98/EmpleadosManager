import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('input[name="email"], input[type="email"], input[placeholder*="email" i]', email);
    await this.page.fill('input[name="password"], input[type="password"]', password);
    await this.page.click('button[type="submit"], button:has-text("Iniciar"), button:has-text("Login"), button:has-text("Entrar")');
  }

  async expectError() {
    await expect(this.page.locator('text=/error|inválido|incorrecto/i')).toBeVisible({ timeout: 5000 });
  }

  async expectRedirectToDashboard() {
    await expect(this.page).toHaveURL(/\/(dashboard|home|intranet)/i, { timeout: 10000 });
  }
}

export class Navigation {
  constructor(private page: Page) {}

  async goToEmployees() {
    await this.page.click('a[href*="employees"], nav a:has-text("Empleados"), button:has-text("Empleados")');
    await expect(this.page).toHaveURL(/employees/i);
  }

  async goToCalendar() {
    await this.page.click('a[href*="calendar"], nav a:has-text("Calendario")');
    await expect(this.page).toHaveURL(/calendar/i);
  }

  async goToVacations() {
    await this.page.click('a[href*="vacation"], nav a:has-text("Vacaciones")');
  }

  async goToProfile() {
    await this.page.click('a[href*="profile"], button:has-text("Perfil"), [aria-label*="Perfil"]');
  }

  async logout() {
    await this.page.click('button:has-text("Cerrar"), button:has-text("Logout"), [aria-label*="logout" i]');
    await expect(this.page).toHaveURL(/login/i);
  }
}

export class EmployeesPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/employees');
    await expect(this.page.locator('h1:has-text("Empleados"), h1:has-text("Employees")')).toBeVisible({ timeout: 10000 });
  }

  async searchEmployee(name: string) {
    const searchInput = this.page.locator('input[placeholder*="buscar" i], input[placeholder*="search" i], input[type="search"]');
    await searchInput.fill(name);
    await this.page.waitForTimeout(500);
  }

  async clickFirstEmployee() {
    await this.page.locator('table tbody tr:first-child, [data-testid="employee-row"]:first-child').first().click();
  }

  async expectEmployeeInTable(name: string) {
    await expect(this.page.locator(`table:has-text("${name}"), text=${name}`).first()).toBeVisible({ timeout: 5000 });
  }

  async clickNewEmployee() {
    await this.page.click('button:has-text("Nuevo"), button:has-text("New"), a[href*="new"]');
  }
}

export class Toast {
  constructor(private page: Page) {}

  async expectSuccess(message?: string) {
    const toast = this.page.locator('[role="alert"]:has-text("éxito"), [role="alert"]:has-text("success"), .toast:has-text("ok")').first();
    await toast.waitFor({ state: 'visible', timeout: 5000 });
    if (message) {
      await expect(toast).toContainText(message);
    }
  }

  async expectError(message?: string) {
    const toast = this.page.locator('[role="alert"]:has-text("error"), [role="alert"]:has-text("Error")').first();
    await toast.waitFor({ state: 'visible', timeout: 5000 });
    if (message) {
      await expect(toast).toContainText(message);
    }
  }
}
