const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('   [CONSOLE ERROR]:', msg.text());
  });
  page.on('response', response => {
    if (response.url().includes('/auth/login')) {
      console.log('   [API LOGIN]', response.status(), response.url());
    }
  });
  
  console.log('1. Login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Debug: find all inputs
  const inputs = await page.$$('input');
  console.log('   Inputs encontrados:', inputs.length);
  for (let i = 0; i < inputs.length; i++) {
    const type = await inputs[i].getAttribute('type');
    const name = await inputs[i].getAttribute('name');
    const placeholder = await inputs[i].getAttribute('placeholder');
    console.log(`     [${i}] type=${type} name=${name} placeholder=${placeholder}`);
  }
  
  // Fill using more specific selectors
  const emailField = await page.$('input[type="text"], input[type="email"]');
  const passField = await page.$('input[type="password"]');
  
  if (emailField && passField) {
    await emailField.click();
    await emailField.fill('test@test.com');
    await passField.click();
    await passField.fill('TestAdmin123!!');
    
    await page.screenshot({ path: 'output/test-debug-filled.png' });
    
    // Use keyboard to submit
    await passField.press('Enter');
    await page.waitForTimeout(4000);
    
    await page.screenshot({ path: 'output/test-debug-after-submit.png' });
    console.log('   URL después de submit:', page.url());
    
    // Check for any toast/error
    const toasts = await page.$$('.sonner, [data-sonner-toaster], [role="status"], [class*="toast"]');
    console.log('   Toasts encontrados:', toasts.length);
    for (const t of toasts) {
      const text = await t.textContent();
      console.log('   Toast:', text.trim().substring(0, 100));
    }
  }
  
  if (!page.url().includes('login')) {
    console.log('   LOGIN EXITOSO!');
    await page.screenshot({ path: 'output/test-01-dashboard.png' });
    
    // Continue tests...
    console.log('\n--- TEST 1: Empleados ---');
    await page.goto('http://localhost:5173/employees', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'output/test-02-employees.png' });
    
    const searchInput = await page.$('input[aria-label="Buscar empleados"]');
    if (searchInput) {
      await searchInput.fill('Juan');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'output/test-03-search.png' });
      console.log('   OK: Búsqueda funcionando');
    }
    
    // Go to first employee
    const empLinks = await page.$$('a[href*="/employees/"]');
    if (empLinks.length > 0) {
      await empLinks[0].click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'output/test-04-employee.png' });
      console.log('   OK: Detalle empleado');
      
      // Look for "Generar Documento" section
      const allText = await page.textContent('body');
      if (allText.includes('Generar Documento') || allText.includes('Generar')) {
        console.log('   Sección de generación encontrada');
      }
    }
    
    // Test Vacations
    console.log('\n--- TEST 2: Vacaciones ---');
    await page.goto('http://localhost:5173/vacations', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'output/test-05-vacations.png' });
    
    const genDoc = await page.$('button:has-text("Generar Documento")');
    if (genDoc) {
      console.log('   OK: Botón Generar Documento encontrado');
    }
  } else {
    console.log('   LOGIN FALLÓ');
  }
  
  console.log('\n=== FIN ===');
  await browser.close();
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
