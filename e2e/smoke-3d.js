// Standalone headless smoke test for the 3D store view (not part of the suite).
// Loads the marketplace, toggles 3D at shop level and shop-interior level,
// captures console errors + screenshots.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
  await page.goto(base + '/#/marketplace', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Toggle to 3D at marketplace level
  const btn3d = page.getByRole('button', { name: /3D/ }).first();
  await btn3d.click();
  await page.waitForTimeout(3500); // chunk load + render
  const canvas1 = await page.locator('canvas').count();
  await page.screenshot({ path: 'shot-3d-shops.png' });
  console.log('after marketplace 3D toggle -> canvas count:', canvas1);

  // Enter a shop by clicking center of canvas (a booth), then check product scene
  const box = await page.locator('canvas').first().boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(2500);
  }
  const canvas2 = await page.locator('canvas').count();
  await page.screenshot({ path: 'shot-3d-after-click.png' });
  console.log('after booth click -> canvas count:', canvas2);

  console.log('CONSOLE ERRORS (' + errors.length + '):');
  errors.slice(0, 20).forEach((e) => console.log('  -', e));

  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
