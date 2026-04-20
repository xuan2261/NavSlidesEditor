import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage.js';
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js';

test.describe('Slides Management', () => {
  test('can add and delete slides in SlidePanel', async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Slides Test Presentation');
    const editor = new EditorPage(page);

    await editor.gotoPresentation(pres.id);

    let count = await editor.getSlideCount();
    expect(count).toBeGreaterThanOrEqual(1);

    await editor.addSlide();
    let newCount = await editor.getSlideCount();
    expect(newCount).toBe(count + 1);

    await editor.deleteSlide(newCount - 1);
    let finalCount = await editor.getSlideCount();
    expect(finalCount).toBe(count);

    await apiDeletePresentation(request, pres.id);
  });
});
