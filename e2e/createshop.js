const { chromium } = require("@playwright/test");
const BASE = "https://hypershopindia.com";
const IMG = require("path").join(__dirname, "shoplogo.png");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  let uploadUrl = null, shopResp = null;
  p.on("response", async r => {
    const u = r.url();
    if (u.endsWith("/api/upload")) { try { uploadUrl = (await r.json()).url; } catch {} }
    if (u.endsWith("/api/shops") && r.request().method() === "POST") { shopResp = { status: r.status(), body: await r.text().catch(()=> "") }; }
  });

  // login as owner
  await p.goto(BASE + "/#/login", { waitUntil: "networkidle" });
  await p.getByPlaceholder("Email address").fill("anand@example.com");
  await p.getByPlaceholder("Password").fill("Owner@123");
  await p.getByPlaceholder("Password").press("Enter");
  await p.waitForFunction(() => !!sessionStorage.getItem("hypermart_token"), { timeout: 15000 });
  await p.waitForTimeout(1500);

  // open "Add New Shop"
  const addBtn = p.getByText("Add New Shop", { exact: false }).first();
  if (await addBtn.count() === 0) {
    console.log("Add New Shop not visible. BODY:", (await p.evaluate(()=>document.body.innerText)).slice(0,400).replace(/\n/g,' '));
    await b.close(); process.exit(2);
  }
  await addBtn.scrollIntoViewIfNeeded(); await addBtn.click();

  // fill form
  await p.getByPlaceholder("Shop name *").fill("Playwright Test Shop");
  await p.getByPlaceholder("Full address *").fill("1 Automation Street, Hyderabad");

  // upload logo (hidden file input)
  await p.locator('input[type=file]').first().setInputFiles(IMG);
  // wait for the preview image (form.logo set after upload completes)
  await p.locator('img[alt="Shop logo preview"]').waitFor({ state: "visible", timeout: 20000 });
  const logoSrc = await p.locator('img[alt="Shop logo preview"]').getAttribute("src");
  console.log("LOGO SRC IN FORM:", logoSrc);
  console.log("UPLOAD RESPONSE URL:", uploadUrl);

  // submit
  await p.getByRole("button", { name: /Submit for Approval/i }).click();
  await p.waitForTimeout(3000);
  console.log("CREATE /shops RESPONSE:", shopResp ? shopResp.status : "(none captured)");
  if (shopResp) console.log("SHOP BODY:", shopResp.body.slice(0,260));
  await b.close();
})();
