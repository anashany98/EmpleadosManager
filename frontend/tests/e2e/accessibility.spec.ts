import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * WCAG 2.1 AA accessibility tests using axe-core.
 *
 * These tests check the most critical pages for accessibility
 * violations. They run against the live dev server and require
 * no backend (they test the rendered HTML structure, not API
 * behavior).
 *
 * Run with: npx playwright test tests/e2e/accessibility.spec.ts
 */

const PAGES_TO_TEST = [
    { name: 'Login', path: '/login' },
    { name: 'Dashboard', path: '/' },
    { name: 'Employees', path: '/employees' },
    { name: 'Reports', path: '/reports' },
];

test.describe('Accessibility (WCAG 2.1 AA)', () => {
    for (const { name, path } of PAGES_TO_TEST) {
        test(`${name} page should have no critical axe violations`, async ({ page }) => {
            await page.goto(path, { waitUntil: 'networkidle' });

            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();

            // Filter out critical and serious violations
            const criticalViolations = results.violations.filter(
                v => v.impact === 'critical' || v.impact === 'serious'
            );

            if (criticalViolations.length > 0) {
                const violationData = criticalViolations.map(v => ({
                    id: v.id,
                    impact: v.impact,
                    description: v.description,
                    help: v.help,
                    nodes: v.nodes.length,
                    targets: v.nodes.slice(0, 3).map(n => n.target[0])
                }));

                console.error(`\n accessibility violations on ${name}:`, JSON.stringify(violationData, null, 2));
            }

            expect(criticalViolations).toEqual([]);
        });
    }

    test('Login page should have proper heading hierarchy', async ({ page }) => {
        await page.goto('/login', { waitUntil: 'networkidle' });

        const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
        expect(headings.length).toBeGreaterThan(0);

        // Should have at least one h1
        const h1 = page.locator('h1');
        await expect(h1).toHaveCount(1);
    });

    test('Login page should have form labels', async ({ page }) => {
        await page.goto('/login', { waitUntil: 'networkidle' });

        const results = await new AxeBuilder({ page })
            .include('form')
            .withRules(['label'])
            .analyze();

        expect(results.violations).toEqual([]);
    });

    test('Login page should have sufficient color contrast', async ({ page }) => {
        await page.goto('/login', { waitUntil: 'networkidle' });

        const results = await new AxeBuilder({ page })
            .withRules(['color-contrast'])
            .analyze();

        expect(results.violations).toEqual([]);
    });

    test('Login page should have keyboard-accessible interactive elements', async ({ page }) => {
        await page.goto('/login', { waitUntil: 'networkidle' });

        const results = await new AxeBuilder({ page })
            .withRules(['keyboard'])
            .analyze();

        expect(results.violations).toEqual([]);
    });
});
