// Bust the report cache by hitting the API with pagination (skips cache)
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newContext().then(c => c.newPage());
    // Login
    await page.goto('http://localhost:17171/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await page.locator('input').first().fill('admin@admin.com');
    await page.locator('input[type="password"]').first().fill('dev12345');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Hit vacations with pagination (bypasses cache)
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const csrf = cookies.find(c => c.name === 'csrf_token')?.value;
    const csrfHeader = csrf ? `X-CSRF-Token: ${csrf}` : '';

    const fetch1 = await page.request.get('http://localhost:17171/api/reports/vacations?year=2026&page=1&limit=50', {
        headers: { Cookie: cookieHeader }
    });
    const json1 = await fetch1.json();
    console.log('Vacations report (paginated, fresh):', JSON.stringify(json1, null, 2).slice(0, 800));

    const fetch2 = await page.request.get('http://localhost:17171/api/reports/absences-detailed?start=2026-01-01&end=2026-12-31&page=1&limit=50', {
        headers: { Cookie: cookieHeader }
    });
    const json2 = await fetch2.json();
    console.log('\nAbsences report (paginated, fresh):', JSON.stringify(json2, null, 2).slice(0, 1500));

    await browser.close();
})();
