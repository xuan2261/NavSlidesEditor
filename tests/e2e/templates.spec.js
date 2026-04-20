import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage.js';

test.describe('Templates', () => {
  test('can view Built-in template gallery', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.switchSidebarView('Built-in');

    await expect(page.locator('.home-content-title')).toContainText('Template Gallery');

    // Should show preset templates
    const cards = page.locator('.presentation-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('can filter templates by category', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.switchSidebarView('Built-in');

    // Click Creative category
    await page.locator('.template-category-btn').filter({ hasText: 'Creative' }).click();
    await page.waitForTimeout(300);

    // Should still show cards
    const cards = page.locator('.presentation-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Click Academic
    await page.locator('.template-category-btn').filter({ hasText: 'Academic' }).click();
    await page.waitForTimeout(300);

    const academicCount = await cards.count();
    expect(academicCount).toBeGreaterThanOrEqual(1);
  });

  test('can create presentation from Built-in template', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.createFromPresetTemplate('Minimal Dark');

    // Should navigate to editor
    expect(page.url()).toContain('/editor/');

    // Verify the canvas has loaded
    await page.waitForSelector('.slide-canvas', { timeout: 30000 });
  });

  test('can view My Templates section', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.switchSidebarView('My Templates');

    await expect(page.locator('.home-content-title')).toContainText('My Templates');
  });

  test('can create a new custom template', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.switchSidebarView('My Templates');

    // Click "New Template" button
    const newTemplateBtn = page.locator('button').filter({ hasText: 'New Template' });
    if (await newTemplateBtn.count() > 0) {
      await newTemplateBtn.first().click();
      // Should navigate to template editor
      await page.waitForURL(/\/template\/.+/, { timeout: 30000 });
      expect(page.url()).toContain('/template/');
    } else {
      // Fallback: "Create Template" button in empty state
      const createBtn = page.locator('button').filter({ hasText: 'Create Template' });
      if (await createBtn.count() > 0) {
        await createBtn.click();
        await page.waitForURL(/\/template\/.+/, { timeout: 30000 });
      }
    }
  });

  test('can view Marketplace section', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.switchSidebarView('Marketplace');

    // Marketplace should load (may show templates or empty)
    await page.waitForTimeout(1000);
    const content = page.locator('.home-content');
    await expect(content).toBeVisible();
  });
});
