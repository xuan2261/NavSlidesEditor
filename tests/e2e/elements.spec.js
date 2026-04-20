import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage.js';
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js';

test.describe('Elements Insertion', () => {
  let editorPage;
  let presId;

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Elements E2E Testing');
    presId = pres.id;
    editorPage = new EditorPage(page);
    await editorPage.gotoPresentation(presId);
  });

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId); } catch {}
  });

  // eslint-disable-next-line unused-imports/no-unused-vars
  test('can insert text, shape and handle prompt for table', async ({ page }) => {
    let initialCount = await editorPage.getElementCount();

    // 1. Thêm Text node
    await editorPage.addTextNode();
    let textCount = await editorPage.getElementCount();
    expect(textCount).toBeGreaterThan(initialCount);

    // 2. Thêm Shape
    await editorPage.addShape('Star');
    let shapeCount = await editorPage.getElementCount();
    expect(shapeCount).toBeGreaterThan(textCount);

    // 3. Xử lý Prompts (Table không còn dùng prompt, dùng grid picker)
    // eslint-disable-next-line unused-imports/no-unused-vars
    const prevCount = await editorPage.getElementCount();
    await editorPage.addTable(3, 3);

    let finalCount = await editorPage.getElementCount();
    expect(finalCount).toBeGreaterThan(shapeCount);
  });
});
