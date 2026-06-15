const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.goto((process.env.E2E_BASE_URL || 'http://localhost:5173') + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  // landing is in an iframe
  const frames = page.frames().length;
  await page.screenshot({ path: 'shot-landing.png' });
  console.log('frames:', frames, '| errors:', errs.length);
  errs.slice(0, 8).forEach(e => console.log('  -', e));
  await browser.close();
})();
