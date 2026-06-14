const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const p = await ctx.newPage();
  await p.goto("https://hypershopindia.com/?_=" + Math.floor(Math.random()*1e6), { waitUntil: "networkidle", timeout: 30000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "mobile_top.png", clip: { x: 0, y: 0, width: 390, height: 240 } });
  console.log("screenshot saved");
  await b.close();
})();
