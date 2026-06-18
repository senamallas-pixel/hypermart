const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 300 } });
  await p.goto('http://localhost:5173/#/marketplace', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.locator('header').first().screenshot({ path: 'logo-shot.png' });
  await b.close();
})();
