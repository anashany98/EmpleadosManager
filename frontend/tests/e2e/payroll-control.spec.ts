import { expect, test } from '@playwright/test';

test.describe('Control mensual de RRHH', () => {
  test.beforeEach(async ({ page }) => {
    const email = process.env.TEST_EMAIL;
    const password = process.env.TEST_PASSWORD;
    test.skip(!email || !password, 'TEST_EMAIL y TEST_PASSWORD son necesarios para este flujo autenticado');

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email o DNI' }).fill(email!);
    await page.getByRole('textbox', { name: 'Contraseña' }).fill(password!);
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await expect(page).not.toHaveURL(/\/login(?:\/|$)/i);
  });

  test('selecciona empresa, muestra históricos y abre la revisión a pantalla completa', async ({ page }) => {
    await page.goto('/payroll/control');
    await expect(page.getByRole('heading', { name: 'Control General de RRHH' })).toBeVisible();

    const company = page.getByLabel('Empresa');
    if (await company.isVisible()) {
      await expect(company).toBeEnabled();
      await expect(company.locator('option')).not.toHaveCount(0);
    }

    await expect(page.getByRole('heading', { name: 'Historial mensual' })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir control mensual a pantalla completa' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /Revisión mensual/ })).toBeVisible();
    await expect(dialog.getByText(/Autoguardado activo|Guardado|Guardando/)).toBeVisible();
  });

  test('la vista de gestoría permite validar contra la plantilla', async ({ page }) => {
    await page.goto('/payroll/control');
    await expect(page.getByRole('button', { name: 'Validar contra plantilla' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Historial de gestoría' })).toBeVisible();
  });
});
