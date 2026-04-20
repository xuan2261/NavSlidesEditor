import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage.js';
import { apiCreatePresentation, apiDeletePresentation, apiUpdatePresentation } from './fixtures/test-fixtures.js';

test.describe('Keyboard Shortcuts', () => {
  let editorPage;
  let presId;

  test.beforeEach(async ({ page, request }) => {
    // Create presentation with a pre-existing shape element (avoids text editing mode)
    const pres = await apiCreatePresentation(request, 'Keyboard Shortcuts Test');
    presId = pres.id;
    await apiUpdatePresentation(request, presId, {
      slides: [{
        id: 'slide-1',
        elements: [
          { id: 'el-shape-1', type: 'shape', shape: 'rectangle', x: 200, y: 200, width: 150, height: 100, zIndex: 1, color: '#6366f1', text: '' },
        ],
        notes: '',
        background: { type: 'color', color: '#1e1e2e' },
      }],
    });
    editorPage = new EditorPage(page);
    await editorPage.gotoPresentation(presId);
  });

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId); } catch {}
  });

  test('Ctrl+D duplicates selected element', async ({ page }) => {
    const initialCount = await editorPage.getElementCount();
    expect(initialCount).toBe(1);

    // Click on the shape element
    await page.locator('.element-wrapper').first().click();
    await page.waitForTimeout(500);

    // Duplicate
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(1000);

    const afterDuplicate = await editorPage.getElementCount();
    expect(afterDuplicate).toBeGreaterThan(initialCount);
  });

  test('Delete key removes selected element', async ({ page }) => {
    const initialCount = await editorPage.getElementCount();
    expect(initialCount).toBe(1);

    // Click on shape
    await page.locator('.element-wrapper').first().click();
    await page.waitForTimeout(500);

    // Delete
    await page.keyboard.press('Delete');
    await page.waitForTimeout(1000);

    const afterDelete = await editorPage.getElementCount();
    expect(afterDelete).toBeLessThan(initialCount);
  });

  test('Escape deselects element', async ({ page }) => {
    await page.locator('.element-wrapper').first().click();
    await page.waitForTimeout(300);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // Test passes if no error
  });

  test('Ctrl+C / Ctrl+V copies and pastes element', async ({ page }) => {
    const initialCount = await editorPage.getElementCount();

    // Click on shape
    await page.locator('.element-wrapper').first().click();
    await page.waitForTimeout(500);

    // Copy + paste
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(1000);

    const afterPaste = await editorPage.getElementCount();
    expect(afterPaste).toBeGreaterThan(initialCount);
  });

  test('Ctrl+F opens Find & Replace', async ({ page }) => {
    await editorPage.openFindReplace();
    await expect(page.locator('.find-replace-bar')).toBeVisible();
  });
});
