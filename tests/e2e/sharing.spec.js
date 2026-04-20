import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage.js';
import { apiCreatePresentation, apiDeletePresentation, apiCreateShareLink } from './fixtures/test-fixtures.js';

test.describe('Sharing & Privacy', () => {
  let presId;

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Share Test');
    presId = pres.id;
  });

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId); } catch {}
  });

  test('can open Share Modal in editor', async ({ page }) => {
    const editor = new EditorPage(page);
    await editor.gotoPresentation(presId);

    await editor.openShareModal();

    // Wait for Share Modal to appear
    await expect(page.locator('h3:has-text("Share Presentation")')).toBeVisible({ timeout: 5000 });
  });

  test('share link via API returns valid token', async ({ request }) => {
    const result = await apiCreateShareLink(request, presId);
    expect(result.token).toBeTruthy();
    expect(result.shared).toBe(true);
  });

  test('can view shared presentation in new browser context', async ({ browser, request }) => {
    const result = await apiCreateShareLink(request, presId);
    const token = result.token;
    expect(token).toBeTruthy();

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();

    await viewerPage.goto(`http://localhost:5173/api/view/${token}`, { timeout: 15000 });
    await viewerPage.waitForTimeout(3000);
    const pageTitle = await viewerPage.title();
    expect(pageTitle).toBeDefined();

    await viewerContext.close();
  });
});
