import { test, expect, Page } from '@playwright/test';

const modules = [
  { path: '/employees', name: 'Employees' },
  { path: '/calendar', name: 'Calendar' },
  { path: '/vacations', name: 'Vacations' },
  { path: '/timesheet', name: 'Timesheet' },
  { path: '/inbox', name: 'Inbox' },
  { path: '/payroll', name: 'Payroll' },
  { path: '/settings', name: 'Settings' },
  { path: '/users', name: 'UserManagement' },
  { path: '/companies', name: 'Companies' },
  { path: '/projects', name: 'Projects' },
  { path: '/reports', name: 'Reports' },
  { path: '/analytics', name: 'Analytics' },
  { path: '/assets', name: 'Assets' },
  { path: '/org-chart', name: 'OrgChart' },
  { path: '/performance', name: 'Performance' },
  { path: '/dashboard', name: 'Dashboard' },
];

async function loginAndWait(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const emailInput = page.locator('input').first();
  await emailInput.waitFor({ timeout: 10000, state: 'visible' });
  await emailInput.fill('admin@admin.com');
  
  await page.locator('input').nth(1).fill('admin123');
  await page.locator('button').first().click();
  
  await page.waitForTimeout(3000);
}

test.describe('Module Debug - Check each page with authentication', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWait(page);
  });

  for (const module of modules) {
    test(`${module.name} (${module.path}) - check for errors`, async ({ page }) => {
      const consoleErrors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('Failed to load resource') && !text.includes('401')) {
            consoleErrors.push(text);
          }
        }
      });

      page.on('pageerror', error => {
        consoleErrors.push(error.message);
      });

      await page.goto(module.path, { timeout: 15000 });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      console.log(`\n${module.name}:`);
      if (consoleErrors.length > 0) {
        console.log(`  ❌ ${consoleErrors.length} errors:`);
        consoleErrors.forEach(e => console.log(`    - ${e.substring(0, 150)}`));
      } else {
        console.log(`  ✅ OK`);
      }

      const screenshotPath = `test-results/error-${module.name.replace('/', '-')}.png`;
      if (consoleErrors.length > 0) {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }

      expect(consoleErrors, `${module.name} should have no errors`).toHaveLength(0);
    });
  }
});

test.describe('Summary Report', () => {
  test('generate complete summary with login', async ({ page }) => {
    await loginAndWait(page);

    const results: { module: string; status: string; errors: string[] }[] = [];

    for (const module of modules) {
      const consoleErrors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('Failed to load resource') && !text.includes('401')) {
            consoleErrors.push(text);
          }
        }
      });

      page.on('pageerror', error => {
        consoleErrors.push(error.message);
      });

      await page.goto(module.path, { timeout: 15000 });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);

      if (consoleErrors.length > 0) {
        results.push({ module: module.name, status: 'ERROR', errors: consoleErrors });
      } else {
        results.push({ module: module.name, status: 'OK', errors: [] });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('FINAL SUMMARY REPORT');
    console.log('='.repeat(60));

    const okCount = results.filter(r => r.status === 'OK').length;
    const errorCount = results.filter(r => r.status === 'ERROR').length;

    console.log(`\n✅ OK: ${okCount}/${modules.length}`);
    console.log(`❌ ERRORS: ${errorCount}/${modules.length}`);

    if (errorCount > 0) {
      console.log('\nModules with errors:');
      results.filter(r => r.status === 'ERROR').forEach(r => {
        console.log(`  - ${r.module}:`);
        r.errors.forEach(e => console.log(`      ${e.substring(0, 100)}`));
      });
    }

    expect(errorCount, `Should have 0 errors, got ${errorCount}`).toBe(0);
  });
});