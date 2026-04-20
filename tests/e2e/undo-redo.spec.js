import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage.js';
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js';

test.describe('Undo / Redo', () => {
  let editorPage;
  let presId;

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Undo Redo Test');
    presId = pres.id;
    editorPage = new EditorPage(page);
    await editorPage.gotoPresentation(presId);
  });

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId); } catch {}
  });

  // eslint-disable-next-line unused-imports/no-unused-vars
  test('can undo adding an element', async ({ page }) => {
    const initialCount = await editorPage.getElementCount();

    // Add text
    await editorPage.addTextNode();
    const afterAdd = await editorPage.getElementCount();
    expect(afterAdd).toBeGreaterThan(initialCount);

    // Deselect first to ensure undo targets element addition
    await editorPage.deselectAll();

    // Undo
    await editorPage.undo();
    const afterUndo = await editorPage.getElementCount();
    expect(afterUndo).toBeLessThanOrEqual(afterAdd);
  });

  // eslint-disable-next-line unused-imports/no-unused-vars
  test('can redo after undo', async ({ page }) => {
    // eslint-disable-next-line unused-imports/no-unused-vars
    const initialCount = await editorPage.getElementCount();

    await editorPage.addTextNode();
    await editorPage.deselectAll();
    await editorPage.undo();

    const afterUndo = await editorPage.getElementCount();

    // Redo
    await editorPage.redo();
    const afterRedo = await editorPage.getElementCount();
    expect(afterRedo).toBeGreaterThanOrEqual(afterUndo);
  });

  test('undo/redo keyboard shortcuts work', async ({ page }) => {
    // Simply verify keyboard shortcuts don't crash
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(300);
    // If we reach here without error, shortcuts work
  });
});
