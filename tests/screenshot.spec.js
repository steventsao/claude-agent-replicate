import { test } from '@playwright/test';

test('capture app screenshot', async ({ page }) => {
  await page.goto('/');

  // Wait for app to load
  await page.waitForTimeout(1500);

  // Take screenshot
  await page.screenshot({
    path: 'app-screenshot.png',
    fullPage: true
  });
});
