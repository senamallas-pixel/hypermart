# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hypermart.spec.js >> login page renders with HyperMart branding and form
- Location: tests\hypermart.spec.js:25:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByPlaceholder('Email address')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByPlaceholder('Email address')

```

```yaml
- banner:
  - button "HyperMart":
    - img
    - text: HyperMart
  - img
  - textbox "Search products, shops…"
  - button "All":
    - img
    - text: All
    - img
  - button "🇺🇸 English":
    - img
    - text: 🇺🇸 English
  - button "Login"
- main:
  - paragraph:
    - img
    - text: All
  - heading "Good morning 👋" [level=2]
  - paragraph: What are you looking for today?
  - button "All"
  - button "Grocery"
  - button "Dairy"
  - button "Vegetables & Fruits"
  - button "Meat"
  - button "Bakery & Snacks"
  - button "Beverages"
  - button "Household"
  - button "Personal Care"
  - img
  - paragraph: "5"
  - paragraph: Shops open
  - img
  - paragraph: All
  - paragraph: Your area
  - img
  - paragraph: Free
  - paragraph: Delivery
  - heading "🌿 Grocery" [level=3]
  - paragraph: Fresh from All• 1 shop
  - button "See All":
    - text: See All
    - img
  - img "Anand Groceries"
  - text: OPEN Grocery
  - heading "Anand Groceries" [level=4]
  - img
  - text: "4.6"
  - paragraph:
    - img
    - text: 12, Main St, Green Valley
  - img
  - img
  - text: Shop
  - heading "🥛 Dairy" [level=3]
  - paragraph: Fresh from All• 1 shop
  - button "See All":
    - text: See All
    - img
  - img "Anand Dairy Fresh"
  - text: OPEN Dairy
  - heading "Anand Dairy Fresh" [level=4]
  - img
  - text: "4.8"
  - paragraph:
    - img
    - text: 5, Milk Lane, Sector 4
  - img
  - img
  - text: Shop
  - heading "🥥 Vegetables & Fruits" [level=3]
  - paragraph: Fresh from All• 1 shop
  - button "See All":
    - text: See All
    - img
  - img "Priya Vegetables"
  - text: OPEN Vegetables & Fruits
  - heading "Priya Vegetables" [level=4]
  - img
  - text: "4.5"
  - paragraph:
    - img
    - text: 8, Veggie Row, Green Valley
  - img
  - img
  - text: Shop
  - heading "🥩 Meat" [level=3]
  - paragraph: Fresh from All
  - paragraph: No shops registered in this category yet.
  - heading "🥏 Bakery & Snacks" [level=3]
  - paragraph: Fresh from All• 1 shop
  - button "See All":
    - text: See All
    - img
  - img "Priya Bakery"
  - text: OPEN Bakery & Snacks
  - heading "Priya Bakery" [level=4]
  - img
  - text: "4.7"
  - paragraph:
    - img
    - text: 27, Baker St, Central Market
  - img
  - img
  - text: Shop
  - heading "☕ Beverages" [level=3]
  - paragraph: Fresh from All• 1 shop
  - button "See All":
    - text: See All
    - img
  - img "Priya Beverages"
  - text: OPEN Beverages
  - heading "Priya Beverages" [level=4]
  - img
  - text: "4.4"
  - paragraph:
    - img
    - text: 3, Food Plaza, Block B
  - img
  - img
  - text: Shop
  - heading "🏠 Household" [level=3]
  - paragraph: Fresh from All
  - paragraph: No shops registered in this category yet.
  - heading "🧹 Personal Care" [level=3]
  - paragraph: Fresh from All
  - paragraph: No shops registered in this category yet.
- button "✨"
```

# Test source

```ts
  1  | // End-to-end UI tests for HyperMart (React frontend + Backend_php + MySQL).
  2  | // Exercises the real stack via the browser: login for each role, marketplace
  3  | // data load, search, and an invalid-login error path.
  4  | const { test, expect } = require('@playwright/test');
  5  | 
  6  | const DEMO = {
  7  |   customer: { email: 'ravi@example.com',       password: 'Customer@123' },
  8  |   owner:    { email: 'anand@example.com',       password: 'Owner@123' },
  9  |   admin:    { email: 'senamallas@gmail.com',     password: 'Admin@123' },
  10 | };
  11 | 
  12 | async function gotoFresh(page) {
  13 |   await page.goto('/');
  14 |   await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  15 |   await page.goto('/');
> 16 |   await expect(page.getByPlaceholder('Email address')).toBeVisible();
     |                                                        ^ Error: expect(locator).toBeVisible() failed
  17 | }
  18 | 
  19 | async function login(page, email, password) {
  20 |   await page.getByPlaceholder('Email address').fill(email);
  21 |   await page.getByPlaceholder('Password').fill(password);
  22 |   await page.getByRole('button', { name: /Sign In/i }).click();
  23 | }
  24 | 
  25 | test('login page renders with HyperMart branding and form', async ({ page }) => {
  26 |   await gotoFresh(page);
  27 |   await expect(page.getByText('HyperMart').first()).toBeVisible();
  28 |   await expect(page.getByPlaceholder('Email address')).toBeVisible();
  29 |   await expect(page.getByPlaceholder('Password')).toBeVisible();
  30 | });
  31 | 
  32 | test('invalid login shows an error and stays on the login form', async ({ page }) => {
  33 |   await gotoFresh(page);
  34 |   await login(page, 'ravi@example.com', 'WrongPassword!');
  35 |   await expect(page.getByText(/Invalid email or password|Login failed/i)).toBeVisible();
  36 |   await expect(page.getByPlaceholder('Email address')).toBeVisible();
  37 | });
  38 | 
  39 | test('customer can log in and see seeded marketplace shops', async ({ page }) => {
  40 |   await gotoFresh(page);
  41 |   await login(page, DEMO.customer.email, DEMO.customer.password);
  42 |   // Login form should disappear once authenticated.
  43 |   await expect(page.getByPlaceholder('Email address')).toHaveCount(0, { timeout: 15000 });
  44 |   // Seeded approved shop should render from the live API.
  45 |   await expect(page.getByText('Anand Groceries').first()).toBeVisible({ timeout: 15000 });
  46 | });
  47 | 
  48 | test('owner can log in and reach the authenticated app', async ({ page }) => {
  49 |   await gotoFresh(page);
  50 |   await login(page, DEMO.owner.email, DEMO.owner.password);
  51 |   await expect(page.getByPlaceholder('Email address')).toHaveCount(0, { timeout: 15000 });
  52 |   await expect(page.getByText('Anand Groceries').first()).toBeVisible({ timeout: 15000 });
  53 | });
  54 | 
  55 | test('admin can log in and reach the authenticated app', async ({ page }) => {
  56 |   await gotoFresh(page);
  57 |   await login(page, DEMO.admin.email, DEMO.admin.password);
  58 |   await expect(page.getByPlaceholder('Email address')).toHaveCount(0, { timeout: 15000 });
  59 | });
  60 | 
```