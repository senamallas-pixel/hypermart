const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 420, height: 860 } });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:5173/#/login',{waitUntil:'networkidle'});
  await p.waitForTimeout(1200);
  await p.getByRole('button',{name:'OTP'}).first().click();
  await p.waitForTimeout(400);
  await p.fill('input[type="tel"]','9001100220');
  await p.getByRole('button',{name:/Send OTP/i}).click();
  await p.waitForTimeout(1500);
  // dev OTP shown in green info text
  const info = await p.locator('p.text-emerald-600').first().innerText().catch(()=>'');
  console.log('info:', info);
  const m = info.match(/(\d{6})/);
  if(m){
    await p.fill('input[inputmode="numeric"]', m[1]);
    await p.fill('input[placeholder*="Your name"]','OTP Web User');
    await p.getByRole('button',{name:/Verify/i}).click();
    await p.waitForTimeout(2500);
    console.log('after verify URL:', p.url());
  } else { console.log('no dev code found'); }
  console.log('errors:', errs.slice(0,5));
  await b.close();
})();
