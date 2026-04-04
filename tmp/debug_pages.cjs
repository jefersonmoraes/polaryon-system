const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', error => logs.push(`[PAGE ERROR] ${error.message}`));
  
  // Go to /kanban directly. It will redirect to login if not authenticated.
  await page.goto('http://localhost:8080/kanban');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(__dirname, 'debug_kanban_1.png') });
  
  // Also check /login directly
  await page.goto('http://localhost:8080/login');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(__dirname, 'debug_login.png') });
  
  fs.writeFileSync(path.join(__dirname, 'debug_logs_app.txt'), logs.join('\n'));
  await browser.close();
})();
