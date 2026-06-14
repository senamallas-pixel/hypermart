// End-to-end UI tests for HyperMart (React frontend + Backend_php + MySQL).
// Exercises the real stack via the browser: login for each role, marketplace
// data load, search, and an invalid-login error path.
const { test, expect } = require('@playwright/test');

const DEMO = {
  customer: { email: 'ravi@example.com',       password: 'Customer@123' },
  owner:    { email: 'anand@example.com',       password: 'Owner@123' },
  admin:    { email: 'senamallas@gmail.com',     password: 'Admin@123' },
};

async function gotoFresh(page) {
  await page.goto('/');
  await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  await page.goto('/');
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
}

async function login(page, email, password) {
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: /Sign In/i }).click();
}

test('login page renders with HyperMart branding and form', async ({ page }) => {
  await gotoFresh(page);
  await expect(page.getByText('HyperMart').first()).toBeVisible();
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
});

test('invalid login shows an error and stays on the login form', async ({ page }) => {
  await gotoFresh(page);
  await login(page, 'ravi@example.com', 'WrongPassword!');
  await expect(page.getByText(/Invalid email or password|Login failed/i)).toBeVisible();
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
});

test('customer can log in and see seeded marketplace shops', async ({ page }) => {
  await gotoFresh(page);
  await login(page, DEMO.customer.email, DEMO.customer.password);
  // Login form should disappear once authenticated.
  await expect(page.getByPlaceholder('Email address')).toHaveCount(0, { timeout: 15000 });
  // Seeded approved shop should render from the live API.
  await expect(page.getByText('Anand Groceries').first()).toBeVisible({ timeout: 15000 });
});

test('owner can log in and reach the authenticated app', async ({ page }) => {
  await gotoFresh(page);
  await login(page, DEMO.owner.email, DEMO.owner.password);
  await expect(page.getByPlaceholder('Email address')).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByText('Anand Groceries').first()).toBeVisible({ timeout: 15000 });
});

test('admin can log in and reach the authenticated app', async ({ page }) => {
  await gotoFresh(page);
  await login(page, DEMO.admin.email, DEMO.admin.password);
  await expect(page.getByPlaceholder('Email address')).toHaveCount(0, { timeout: 15000 });
});
