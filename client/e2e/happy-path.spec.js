import { test } from '@playwright/test';

test('create and execute campaign', async ({ page }) => {
  // 1. Login
  await page.goto('/');

  // 2. Navigate to campaigns
  // await page.getByTitle('Campaigns').click();

  // 3. Create new campaign with 3 leads
  // await page.getByRole('button', { name: /new campaign/i }).click();

  // 4. Activate campaign
  // await page.getByRole('button', { name: /create & activate/i }).click();

  // 5. Go to task inbox
  // await page.getByRole('button', { name: /task inbox/i }).click();

  // 6. Complete first task
  // await page.getByRole('button', { name: /mark done/i }).first().click();

  // 7. Set outcome on one lead
  // await page.getByLabel(/set outcome/i).selectOption('replied');

  // 8. Verify dashboard stats
  // await page.getByRole('button', { name: /back to campaigns/i }).click();
});
