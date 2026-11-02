import { test, expect } from '@playwright/test';
import {
  ADMIN_PASSWORD,
  ADMIN_PHONE,
  login,
  registerBuyer,
  registerFarmer,
  uniquePhone,
} from './helpers';

/**
 * Farmer lists a crop -> buyer offers -> admin approves the buyer (required:
 * `requireVerifiedBuyer` blocks offers from a pending buyer, so this step is
 * load-bearing, not optional) -> farmer accepts -> buyer pays into escrow ->
 * both sides confirm pickup -> both rate each other.
 */
test('full order flow: list, offer, verify, accept, pay, confirm, rate', async ({ browser }) => {
  const farmer = {
    name: 'QA Flow Farmer',
    phone: uniquePhone(1),
    district: 'Salem',
    crops: ['Tomato'],
  };
  const buyer = {
    name: 'QA Flow Buyer',
    phone: uniquePhone(2),
    district: 'Coimbatore',
    businessName: 'QA Traders',
  };

  const farmerCtx = await browser.newContext();
  const buyerCtx = await browser.newContext();
  const adminCtx = await browser.newContext();
  const farmerPage = await farmerCtx.newPage();
  const buyerPage = await buyerCtx.newPage();
  const adminPage = await adminCtx.newPage();

  await test.step('register farmer and buyer', async () => {
    await registerFarmer(farmerPage, farmer);
    await registerBuyer(buyerPage, buyer);
  });

  await test.step('admin verifies the buyer', async () => {
    await login(adminPage, ADMIN_PHONE, ADMIN_PASSWORD);
    await adminPage.goto('/app/admin');
    await adminPage.getByPlaceholder('Search by name or phone').fill(buyer.phone);
    await expect(adminPage.getByText(buyer.name)).toBeVisible();
    await adminPage.getByRole('button', { name: 'Approve' }).click();
    await expect(adminPage.getByText('Buyer approved.')).toBeVisible();
  });

  await test.step('farmer lists a crop', async () => {
    await farmerPage.goto('/app/listings');
    await farmerPage.getByRole('button', { name: 'List a crop' }).click();

    // getByLabel('Crop') also matches the dialog itself (titled "List a
    // crop"); role=combobox narrows to the actual select trigger.
    await farmerPage.getByRole('combobox', { name: /^Crop/ }).click();
    await farmerPage.getByRole('option', { name: 'Tomato' }).click();
    await farmerPage.getByRole('combobox', { name: /^Grade/ }).click();
    await farmerPage.getByRole('option', { name: 'Grade A' }).click();
    await farmerPage.getByLabel('Quantity (kg)').fill('100');
    await farmerPage.getByLabel('Price you want (per kg)').fill('20');
    const readyDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await farmerPage.getByLabel('Ready for pickup on').fill(readyDate);

    await farmerPage.getByRole('button', { name: 'List this crop' }).click();
    await expect(farmerPage.getByText('Your crop is listed.')).toBeVisible();
    // Dialog unmount (which drops its hidden native <select>) can lag the
    // toast slightly; wait for it so 'Tomato' resolves to the card alone.
    await expect(farmerPage.getByRole('dialog')).not.toBeVisible();
    await expect(farmerPage.getByText('Tomato')).toBeVisible();
  });

  await test.step('buyer makes an offer', async () => {
    await buyerPage.goto('/app/browse');
    const card = buyerPage.locator('.rounded-lg.border').filter({ hasText: farmer.name });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Make an offer' }).click();

    await buyerPage.getByLabel('Quantity you want (kg)').fill('50');
    await buyerPage.getByLabel('Your offer (per kg)').fill('21');
    await buyerPage.getByRole('button', { name: 'Send offer' }).click();
    await expect(buyerPage.getByText('Your offer has been sent.')).toBeVisible();
  });

  await test.step('farmer accepts the offer', async () => {
    await farmerPage.goto('/app/listings');
    await farmerPage.getByRole('button', { name: 'View offers' }).click();
    await expect(farmerPage.getByText(buyer.name)).toBeVisible();
    await farmerPage.getByRole('button', { name: 'Accept' }).click();
    await expect(
      farmerPage.getByText('Offer accepted. The buyer can now pay into escrow.'),
    ).toBeVisible();
  });

  await test.step('buyer pays into escrow', async () => {
    await buyerPage.goto('/app/orders');
    await expect(buyerPage.getByText('Tomato')).toBeVisible();
    await buyerPage.getByRole('button', { name: 'Pay into escrow' }).click();
    await expect(buyerPage.getByText('Payment sent to escrow.')).toBeVisible();
  });

  await test.step('both sides confirm pickup', async () => {
    await buyerPage.getByRole('button', { name: 'Confirm pickup' }).click();
    await expect(buyerPage.getByText('Pickup confirmed.')).toBeVisible();

    await farmerPage.goto('/app/orders');
    await farmerPage.getByRole('button', { name: 'Confirm pickup' }).click();
    await expect(farmerPage.getByText('Pickup confirmed.')).toBeVisible();
  });

  await test.step('both sides rate the order', async () => {
    await farmerPage.reload();
    await farmerPage.getByRole('button', { name: 'Rate this order' }).click();
    await farmerPage.getByRole('radio', { name: '5' }).click();
    await farmerPage.getByRole('button', { name: 'Submit rating' }).click();
    await expect(farmerPage.getByText('Thanks for your rating.')).toBeVisible();

    await buyerPage.reload();
    await buyerPage.getByRole('button', { name: 'Rate this order' }).click();
    await buyerPage.getByRole('radio', { name: '5' }).click();
    await buyerPage.getByRole('button', { name: 'Submit rating' }).click();
    await expect(buyerPage.getByText('Thanks for your rating.')).toBeVisible();
  });

  await farmerCtx.close();
  await buyerCtx.close();
  await adminCtx.close();
});
