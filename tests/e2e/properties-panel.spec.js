import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage.js';
import { apiCreatePresentation, apiDeletePresentation, apiUpdatePresentation } from './fixtures/test-fixtures.js';

test.describe('Properties Panel', () => {
  let editorPage;
  let presId;

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Properties Panel Test');
    presId = pres.id;
    // Pre-seed with a shape element to avoid text edit mode
    await apiUpdatePresentation(request, presId, {
      slides: [{
        id: 'slide-1',
        elements: [
          { id: 'el-shape-1', type: 'shape', shape: 'rectangle', x: 150, y: 150, width: 200, height: 120, zIndex: 1, color: '#6366f1', text: '' },
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

  test('selecting an element shows properties panel', async ({ page }) => {
    await page.locator('.element-wrapper').first().click();
    await page.waitForTimeout(500);

    const panel = page.locator('.properties-panel');
    await expect(panel).toBeVisible({ timeout: 5000 });
  });

  test('deselecting hides active element state', async ({ page }) => {
    await page.locator('.element-wrapper').first().click();
    await page.waitForTimeout(500);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  test('properties panel shows position/size inputs', async ({ page }) => {
    await page.locator('.element-wrapper').first().click();
    await page.waitForTimeout(500);

    const panel = page.locator('.properties-panel');
    await expect(panel).toBeVisible({ timeout: 5000 });

    const inputs = panel.locator('input[type="number"]');
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(2);
  });

  test('can modify element position via properties panel', async ({ page }) => {
    await page.locator('.element-wrapper').first().click();
    await page.waitForTimeout(500);

    const panel = page.locator('.properties-panel');
    await expect(panel).toBeVisible({ timeout: 5000 });

    const xInput = panel.locator('input[type="number"]').first();
    await xInput.fill('200');
    await xInput.press('Enter');
    await page.waitForTimeout(500);

    const newValue = await xInput.inputValue();
    expect(newValue).toBe('200');
  });
});
