const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', error => logs.push(`[PAGE ERROR] ${error.message}`));
  
  // Go to Vite port we just discovered
  await page.goto('http://localhost:8080');
  
  // Wait a bit for potential JS crash
  await page.waitForTimeout(3000);
  
  const screenshotPath = path.join(__dirname, 'debug_screenshot_crash.png');
  await page.screenshot({ path: screenshotPath });
  
  fs.writeFileSync(path.join(__dirname, 'debug_logs.txt'), logs.join('\n'));
  console.log(`Screenshot saved to ${screenshotPath}`);
  console.log('Logs captured.');
  
  await browser.close();
})();
