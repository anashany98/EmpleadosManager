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

test.describe('Module Debug - Check each page loads', () => {
  test('all modules - check for console errors', async ({ page }) => {
    const results: { module: string; status: string; errors: string[] }[] = [];

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    for (const module of modules) {
      console.log(`\nTesting ${module.name}...`);
      
      await page.goto(module.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const currentErrors = [...consoleErrors];
      if (currentErrors.length > 0) {
        console.log(`  ❌ ERRORS: ${currentErrors.length}`);
        currentErrors.forEach(e => console.log(`    - ${e.substring(0, 100)}`));
        results.push({ module: module.name, status: 'ERROR', errors: currentErrors });
      } else {
        console.log(`  ✅ OK`);
        results.push({ module: module.name, status: 'OK', errors: [] });
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('RESULTS:');
    
    const errors = results.filter(r => r.status === 'ERROR');
    console.log(`OK: ${results.length - errors.length}/${modules.length}`);
    console.log(`ERRORS: ${errors.length}/${modules.length}`);
    
    if (errors.length > 0) {
      console.log('\nModules with errors:');
      errors.forEach(e => console.log(`  - ${e.module}: ${e.errors.length} errors`));
    }

    expect(errors.length, `Expected 0 module errors, got ${errors.length}`).toBe(0);
  });
});