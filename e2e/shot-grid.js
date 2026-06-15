const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto((process.env.E2E_BASE_URL || 'http://localhost:5173') + '/#/marketplace', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'shot-grid.png', fullPage: false });
  await browser.close();
})();
