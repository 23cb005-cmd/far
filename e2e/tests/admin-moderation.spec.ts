import { test, expect } from '@playwright/test';
import { ADMIN_PASSWORD, ADMIN_PHONE, login, registerFarmer, uniquePhone } from './helpers';

/**
 * The original spec asked for "admin resolves a dispute" - this codebase has
 * no dispute flow (a deliberate Phase 4 scope cut, no `disputed` order
 * status exists). Suspend/unsuspend is the admin moderation capability that
 * actually exists, so it stands in for that step.
 */
test('admin suspends and unsuspends a user', async ({ browser }) => {
  const farmer = {
    name: 'QA Moderation Farmer',
    phone: uniquePhone(3),
    district: 'Erode',
    crops: ['Onion'],
  };

  const farmerCtx = await browser.newContext();
  const adminCtx = await browser.newContext();
  const farmerPage = await farmerCtx.newPage();
  const adminPage = await adminCtx.newPage();

  await registerFarmer(farmerPage, farmer);
  await login(adminPage, ADMIN_PHONE, ADMIN_PASSWORD);
  await adminPage.goto('/app/admin');
  await adminPage.getByPlaceholder('Search by name or phone').fill(farmer.phone);

  const row = adminPage.locator('.rounded-lg.border').filter({ hasText: farmer.name });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: 'Suspend' }).click();
  await adminPage
    .getByPlaceholder('Reason for suspension (shown to the user)')
    .fill('E2E test suspension.');
  await adminPage.getByRole('button', { name: 'Suspend account' }).click();
  await expect(adminPage.getByText('Account suspended.')).toBeVisible();
  await expect(row.getByText('Suspended')).toBeVisible();

  // Revoked tokenVersion: the farmer's existing session is now invalid.
  await farmerPage.reload();
  await expect(farmerPage).toHaveURL(/\/login/);

  await row.getByRole('button', { name: 'Unsuspend' }).click();
  await expect(adminPage.getByText('Account reinstated.')).toBeVisible();
  await expect(row.getByText('Suspended')).not.toBeVisible();

  await login(farmerPage, farmer.phone, 'farmfair1');
  await expect(farmerPage).toHaveURL(/\/app\//);

  await farmerCtx.close();
  await adminCtx.close();
});
