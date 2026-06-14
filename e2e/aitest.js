const { chromium } = require("@playwright/test");
const B = "https://hypershopindia.com";
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push("PAGEERR: " + e.message));
  p.on("console", m => { if (m.type()==="error") errs.push("CONSOLE: " + m.text().slice(0,120)); });
  // login as customer
  await p.goto(B + "/#/login", { waitUntil: "networkidle" });
  await p.getByPlaceholder("Email address").fill("ravi@example.com");
  await p.getByPlaceholder("Password").fill("Customer@123");
  await p.getByPlaceholder("Password").press("Enter");
  await p.waitForFunction(() => !!sessionStorage.getItem("hypermart_token"), { timeout: 15000 });
  await p.waitForTimeout(1500);
  // FAB present?
  const fab = p.getByTitle("Open AI Assistant");
  console.log("AI FAB visible:", await fab.isVisible().catch(()=>false));
  await fab.click();
  await p.waitForTimeout(600);
  console.log("panel header visible:", await p.getByText("HyperShopIndia Assistant").isVisible().catch(()=>false));
  // send a message
  await p.getByPlaceholder("Ask anything…").fill("what dairy products do you have?");
  await p.getByPlaceholder("Ask anything…").press("Enter");
  // wait for reply (assistant bubble appears, not the connection-issue text)
  await p.waitForTimeout(8000);
  const body = await p.evaluate(()=>document.body.innerText);
  console.log("got reply with prices:", /₹\d+/.test(body));
  console.log("connection issue shown:", body.includes("Connection issue"));
  console.log("ERRORS:", errs.length ? errs.slice(0,5).join(" | ") : "none");
  await b.close();
})();
