import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage.js';
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js';

test.describe('Live Presentation & WebSockets', () => {
  let presId;

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Live Test');
    presId = pres.id;
  });

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId); } catch {}
  });

  test('can create a live room via API', async ({ request }) => {
    const res = await request.post('http://localhost:5173/api/live/room');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.roomCode).toBeTruthy();
  });

  test('can open Present Live button and see modal', async ({ page }) => {
    const editor = new EditorPage(page);
    await editor.gotoPresentation(presId);

    await editor.startBroadcast();

    // Wait for API call and modal to open
    await page.waitForSelector('h3:has-text("Present Live")', { timeout: 10000 });
    await expect(page.locator('h3:has-text("Present Live")')).toBeVisible();
  });

  test('live room URL contains room code', async ({ page }) => {
    const editor = new EditorPage(page);
    await editor.gotoPresentation(presId);

    await editor.startBroadcast();

    // Check that the room code input exists
    const roomInput = page.locator('input[readonly]').first();
    const value = await roomInput.inputValue();
    expect(value).toContain('/live/');
  });
});
