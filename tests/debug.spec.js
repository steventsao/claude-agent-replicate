import { test } from '@playwright/test';

test('debug image generation', async ({ page }) => {
  // Listen to console messages
  page.on('console', msg => {
    console.log('BROWSER:', msg.type(), msg.text());
  });

  // Listen to page errors
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  await page.goto('/');

  // Wait for connection
  await page.waitForTimeout(2000);

  console.log('=== Sending test message ===');

  const textarea = page.locator('.chat-input textarea');
  await textarea.fill('generate a tennis player');

  const sendButton = page.locator('.chat-input button');
  await sendButton.click();

  console.log('=== Waiting for response ===');

  // Wait for agent response
  await page.waitForTimeout(10000);

  // Check Redux state via window
  const reduxState = await page.evaluate(() => {
    return window.store?.getState();
  });

  console.log('Redux State:', JSON.stringify(reduxState, null, 2));

  // Take screenshot
  await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
});
