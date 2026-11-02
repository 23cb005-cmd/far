import type { Page } from '@playwright/test';

/**
 * Seeded accounts live on +9190000010xx/102x - stay off that range so a run
 * never collides with `npm run seed` data or a previous run's leftovers.
 */
export function uniquePhone(salt: number): string {
  const suffix = String((Date.now() % 1_000_000_000) + salt)
    .padStart(9, '0')
    .slice(-9);
  return `7${suffix}`;
}

export const ADMIN_PHONE = '9000000001';
export const ADMIN_PASSWORD = 'farmfair1';

/**
 * The register wizard renders "Next" and "Create account" in the same JSX
 * slot, so React reuses the DOM node across the step transition rather than
 * remounting it. CDP-dispatched mouse/keyboard events can land mid-mutation,
 * right as that node's `type` flips from `button` to `submit`, triggering an
 * implicit form submission one step early. A plain DOM `.click()` sidesteps
 * the coordinate/focus-based race entirely.
 */
async function clickViaDom(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name }).evaluate((el) => (el as HTMLButtonElement).click());
}

export async function login(page: Page, phone: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Mobile number').fill(phone);
  await page.getByLabel(/^Password/).fill(password);
  await Promise.all([
    page.waitForURL(/\/app\//),
    page.getByRole('button', { name: 'Log in' }).click(),
  ]);
}

export interface FarmerDetails {
  name: string;
  phone: string;
  district: string;
  crops: string[];
}

export async function registerFarmer(page: Page, details: FarmerDetails): Promise<void> {
  await page.goto('/register');
  await page.getByRole('button', { name: 'I am a farmer' }).click();

  await page.getByLabel('Full name').fill(details.name);
  await page.getByLabel('Mobile number').fill(details.phone);
  await page.getByLabel(/^Password/).fill('farmfair1');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByLabel('District').click();
  await page.getByRole('option', { name: details.district, exact: true }).click();
  for (const crop of details.crops) {
    await page.getByRole('checkbox', { name: crop }).click();
  }
  await clickViaDom(page, 'Next');

  await Promise.all([
    page.waitForURL(/\/app\//),
    page.getByRole('button', { name: 'Create account' }).click(),
  ]);
}

export interface BuyerDetails {
  name: string;
  phone: string;
  district: string;
  businessName: string;
}

export async function registerBuyer(page: Page, details: BuyerDetails): Promise<void> {
  await page.goto('/register');
  await page.getByRole('button', { name: 'I am a buyer' }).click();

  await page.getByLabel('Full name').fill(details.name);
  await page.getByLabel('Mobile number').fill(details.phone);
  await page.getByLabel(/^Password/).fill('farmfair1');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByLabel('District').click();
  await page.getByRole('option', { name: details.district, exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByLabel('Business name').fill(details.businessName);
  await clickViaDom(page, 'Next');

  await Promise.all([
    page.waitForURL(/\/app\//),
    page.getByRole('button', { name: 'Create account' }).click(),
  ]);
}
