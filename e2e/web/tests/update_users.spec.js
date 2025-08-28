import { test, expect } from '@playwright/test';

test('update latest user details', async ({ page }) => {
  const adminUsersUrl = process.env.DJANGO_ADMIN_USERS_URL || 'https://cdm.st4ge.com/2tNFZrSGvTr9CqKM8Wsf5alcO9mBNwo4/users/user/';
  await page.goto(adminUsersUrl);
  // Open most recent user (adjust as per admin UI sort)
  await page.locator('table tbody tr').first().getByRole('link').first().click();
  // Change name and save
  await page.getByLabel(/Name/i).fill(`Updated ${Date.now()}`);
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText(/updated/i)).toBeVisible();
});


