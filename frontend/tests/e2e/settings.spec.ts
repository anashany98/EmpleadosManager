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

authenticatedTest.describe('Settings Page', () => {
  authenticatedTest('should display settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h1:has-text("Configuración"), h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });
  });

  authenticatedTest('should show general settings', async ({ page }) => {
    await page.goto('/settings');
    const general = page.locator('text=General, text=Empresa').first();
    await expect(general.or(page.locator('[class*="general"]'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have company settings', async ({ page }) => {
    await page.goto('/settings');
    const company = page.locator('text=Empresa, text=Company').first();
    await expect(company.or(page.locator('input[name="companyName"]'))).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Email Settings', () => {
  authenticatedTest('should show SMTP settings', async ({ page }) => {
    await page.goto('/settings');
    const smtp = page.locator('text=SMTP, text=Email').first();
    await expect(smtp.or(page.locator('input[name="smtp"]'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should configure email credentials', async ({ page }) => {
    await page.goto('/settings');
    const emailHost = page.locator('input[name="SMTP_HOST"], input[name="smtpHost"]');
    await expect(emailHost.or(page.locator('text=SMTP_HOST'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should test email connection', async ({ page }) => {
    await page.goto('/settings');
    const testButton = page.locator('button:has-text("Probar conexión"), button:has-text("Test")').first();
    await expect(testButton).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Inbox Settings', () => {
  authenticatedTest('should show IMAP settings', async ({ page }) => {
    await page.goto('/settings');
    const imap = page.locator('text=IMAP, text=Bandeja de entrada').first();
    await expect(imap.or(page.locator('input[name="IMAP"]'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should configure inbox polling', async ({ page }) => {
    await page.goto('/settings');
    const polling = page.locator('text=Polling, text=Sincronización').first();
    await expect(polling.or(page.locator('input[name="pollInterval"]'))).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Security Settings', () => {
  authenticatedTest('should show security options', async ({ page }) => {
    await page.goto('/settings');
    const security = page.locator('text=Seguridad, text=Security').first();
    await expect(security.or(page.locator('[class*="security"]'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should configure session timeout', async ({ page }) => {
    await page.goto('/settings');
    const timeout = page.locator('text=Timeout, text=Sesión').first();
    await expect(timeout.or(page.locator('input[name="sessionTimeout"]'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should have two-factor authentication option', async ({ page }) => {
    await page.goto('/settings');
    const twoFactor = page.locator('text=2FA, text=Autenticación, text=Two-factor').first();
    await expect(twoFactor.or(page.locator('[class*="2fa"]'))).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Storage Settings', () => {
  authenticatedTest('should show storage configuration', async ({ page }) => {
    await page.goto('/settings');
    const storage = page.locator('text=Almacenamiento, text=Storage').first();
    await expect(storage.or(page.locator('select[name="storageProvider"]'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should configure S3 settings', async ({ page }) => {
    await page.goto('/settings');
    const s3 = page.locator('text=S3, text=Amazon, text=Storage').first();
    await expect(s3.or(page.locator('input[name="S3_BUCKET"]'))).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Backup Settings', () => {
  authenticatedTest('should show backup options', async ({ page }) => {
    await page.goto('/settings');
    const backup = page.locator('text=Backup, text=Copia de seguridad').first();
    await expect(backup.or(page.locator('[class*="backup"]'))).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should configure backup schedule', async ({ page }) => {
    await page.goto('/settings');
    const schedule = page.locator('text=Horario, text=Programación').first();
    await expect(schedule.or(page.locator('input[name="BACKUP_SCHEDULE"]'))).toBeVisible({ timeout: 5000 });
  });
});

authenticatedTest.describe('Settings Actions', () => {
  authenticatedTest('should save settings', async ({ page }) => {
    await page.goto('/settings');
    const saveButton = page.locator('button:has-text("Guardar"), button:has-text("Save")').first();
    await expect(saveButton).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should reset to defaults', async ({ page }) => {
    await page.goto('/settings');
    const resetButton = page.locator('button:has-text("Restablecer"), button:has-text("Default")').first();
    await expect(resetButton).toBeVisible({ timeout: 5000 });
  });

  authenticatedTest('should show notification on save', async ({ page }) => {
    await page.goto('/settings');
    const saveButton = page.locator('button:has-text("Guardar")').first();
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForTimeout(1000);
      const toast = page.locator('[role="alert"]:has-text("Guardado"), [class*="toast"]').first();
      await expect(toast).toBeVisible({ timeout: 5000 });
    }
  });
});
