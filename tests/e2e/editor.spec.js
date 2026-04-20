import { test } from '@playwright/test';
import { EditorPage } from './pages/EditorPage.js';
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js';

test.describe('Editor POM Workflow', () => {
  test('should create presentation and change background using POM', async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'E2E POM Editor Test');
    const editor = new EditorPage(page);

    await editor.gotoPresentation(pres.id);

    // Verify slide background feature
    await editor.changeBackgroundToGradient();

    await apiDeletePresentation(request, pres.id);
  });
});
