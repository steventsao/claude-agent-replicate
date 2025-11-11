import { test, expect } from '@playwright/test';

test.describe('Claude Agent + Replicate App', () => {
  test('should load the app with canvas and chat panel', async ({ page }) => {
    await page.goto('/');

    // Check for React Flow canvas
    await expect(page.locator('.react-flow')).toBeVisible();

    // Check for chat panel
    await expect(page.locator('.chat-panel')).toBeVisible();

    // Check for chat header
    await expect(page.getByText('Claude Agent + Replicate')).toBeVisible();

    // Check for connection status
    const status = page.locator('.status');
    await expect(status).toBeVisible();

    // Check for message input
    const textarea = page.locator('.chat-input textarea');
    await expect(textarea).toBeVisible();

    // Check for send button
    const sendButton = page.locator('.chat-input button');
    await expect(sendButton).toBeVisible();

    // Check React Flow controls are present
    await expect(page.locator('.react-flow__controls')).toBeVisible();

    // Check MiniMap is present
    await expect(page.locator('.react-flow__minimap')).toBeVisible();

    // Check Background is present
    await expect(page.locator('.react-flow__background')).toBeVisible();
  });

  test('should have correct layout - canvas on left, chat on right', async ({ page }) => {
    await page.goto('/');

    const root = page.locator('#root > div');
    const styles = await root.evaluate(el => window.getComputedStyle(el));

    // Check flex display
    expect(styles.display).toBe('flex');

    // Check chat panel is 400px wide
    const chatPanel = page.locator('.chat-panel');
    const chatWidth = await chatPanel.evaluate(el => el.offsetWidth);
    expect(chatWidth).toBe(400);
  });

  test('should show welcome message', async ({ page }) => {
    await page.goto('/');

    // Wait for welcome message
    await page.waitForTimeout(1000);

    // Check for welcome message in chat
    await expect(page.locator('.message.agent')).toContainText('Welcome');
  });

  test('chat input should be enabled when connected', async ({ page }) => {
    await page.goto('/');

    // Wait for connection
    await page.waitForTimeout(1500);

    const status = page.locator('.status');
    const statusText = await status.textContent();

    const textarea = page.locator('.chat-input textarea');
    const sendButton = page.locator('.chat-input button');

    if (statusText === 'connected') {
      // If connected, input should be enabled
      await expect(textarea).toBeEnabled();

      // Type a message
      await textarea.fill('test message');
      await expect(sendButton).toBeEnabled();
    } else {
      // If not connected, should be disabled
      await expect(textarea).toBeDisabled();
      await expect(sendButton).toBeDisabled();
    }
  });

  test('should clear chat when clear button clicked', async ({ page }) => {
    await page.goto('/');

    // Wait for welcome message
    await page.waitForTimeout(1000);

    // Click clear button
    const clearButton = page.locator('.clear-button');
    await clearButton.click();

    // Wait a bit
    await page.waitForTimeout(500);

    // Should show cleared message
    const messages = page.locator('.message');
    const count = await messages.count();

    // Should have at least one message (the "cleared" confirmation)
    expect(count).toBeGreaterThan(0);
  });
});
