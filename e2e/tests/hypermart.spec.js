// End-to-end UI tests for HyperMart (React frontend + Backend_php + MySQL).
// Drives the real browser against the live stack: public marketplace data load,
// login for each role (token issued), and an invalid-login error path.
const { test, expect } = require('@playwright/test');

const DEMO = {
  customer: { email: 'ravi@example.com',     password: 'Customer@123' },
  owner:    { email: 'anand@example.com',     password: 'Owner@123' },
  admin:    { email: 'senamallas@gmail.com',   password: 'Admin@123' },
};

async function fresh(page, hash = '/') {
  await page.goto('/');
  await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  await page.goto('/#' + hash, { waitUntil: 'networkidle' });
}

async function login(page, email, password) {
  await fresh(page, '/login');
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByPlaceholder('Password').press('Enter');
}

const token = (page) => page.evaluate(() => sessionStorage.getItem('hypermart_token'));

test('public marketplace loads seeded shops from the live API', async ({ page }) => {
  await fresh(page, '/marketplace');
  await expect(page.getByText('HyperMart').first()).toBeVisible();
  await expect(page.getByText('Anand Groceries').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Anand Dairy Fresh').first()).toBeVisible();
});

test('login page renders the sign-in form', async ({ page }) => {
  await fresh(page, '/login');
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign In/i }).first()).toBeVisible();
});

test('invalid login shows an error and issues no token', async ({ page }) => {
  await login(page, 'ravi@example.com', 'WrongPassword!');
  await expect(page.getByText(/Invalid email or password|Login failed/i)).toBeVisible();
  expect(await token(page)).toBeNull();
});

test('customer can log in (token issued) and sees marketplace', async ({ page }) => {
  await login(page, DEMO.customer.email, DEMO.customer.password);
  await expect.poll(() => token(page), { timeout: 15000 }).not.toBeNull();
  await expect(page.getByText('Anand Groceries').first()).toBeVisible({ timeout: 15000 });
});

test('owner can log in (token issued)', async ({ page }) => {
  await login(page, DEMO.owner.email, DEMO.owner.password);
  await expect.poll(() => token(page), { timeout: 15000 }).not.toBeNull();
});

test('admin can log in (token issued)', async ({ page }) => {
  await login(page, DEMO.admin.email, DEMO.admin.password);
  await expect.poll(() => token(page), { timeout: 15000 }).not.toBeNull();
});
