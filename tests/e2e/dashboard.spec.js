import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage.js';
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js';

test.describe('Dashboard & Navigation', () => {
  test('sidebar navigation shows correct views', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();

    await expect(page.locator('.sidebar-item').filter({ hasText: 'Recent' })).toBeVisible();
    await expect(page.locator('.sidebar-item').filter({ hasText: 'All Presentations' })).toBeVisible();
    await expect(page.locator('.sidebar-item').filter({ hasText: 'Built-in' })).toBeVisible();
    await expect(page.locator('.sidebar-item').filter({ hasText: 'My Templates' })).toBeVisible();
    await expect(page.locator('.sidebar-item').filter({ hasText: 'Marketplace' })).toBeVisible();
    await expect(page.locator('.sidebar-item').filter({ hasText: 'Trash' })).toBeVisible();
    await expect(page.locator('.sidebar-item').filter({ hasText: 'Explore' })).toBeVisible();
  });

  test('can switch sidebar views', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();

    await home.switchSidebarView('Recent');
    await expect(page.locator('.sidebar-item.active').filter({ hasText: 'Recent' })).toBeVisible();

    await home.switchSidebarView('Built-in');
    await expect(page.locator('.home-content-title')).toContainText('Template Gallery');
  });

  test('can search presentations', async ({ page, request }) => {
    const pres1 = await apiCreatePresentation(request, 'Alpha Unique Name');
    const pres2 = await apiCreatePresentation(request, 'Beta Other Name');

    const home = new HomePage(page);
    await home.goto();

    await home.searchPresentation('Alpha');
    const cards = page.locator('.presentation-card');
    await expect(cards.filter({ hasText: 'Alpha' })).toBeVisible();

    await home.clearSearch();

    await apiDeletePresentation(request, pres1.id);
    await apiDeletePresentation(request, pres2.id);
  });

  test('can create a new presentation from modal', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.createNewPresentation('Dashboard E2E Test');

    expect(page.url()).toContain('/editor/');
  });

  test('can duplicate a presentation via API', async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Dup Source');

    // Duplicate via API
    const res = await request.post(`http://localhost:5173/api/presentations/${pres.id}/duplicate`);
    expect(res.ok()).toBeTruthy();
    const copy = await res.json();
    expect(copy.title).toContain('(copy)');

    // Cleanup both
    await apiDeletePresentation(request, pres.id);
    await apiDeletePresentation(request, copy.id);
  });

  test('can delete to trash and restore via API', async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Trash Flow Test');

    // Soft delete
    const delRes = await request.delete(`http://localhost:5173/api/presentations/${pres.id}`);
    expect(delRes.ok()).toBeTruthy();

    // Verify in trash
    const trashRes = await request.get('http://localhost:5173/api/presentations/trash/list');
    const trashData = await trashRes.json();
    const inTrash = trashData.find(t => t.id === pres.id);
    expect(inTrash).toBeTruthy();

    // Restore
    const restoreRes = await request.post(`http://localhost:5173/api/presentations/${pres.id}/restore`);
    expect(restoreRes.ok()).toBeTruthy();

    // Cleanup
    await apiDeletePresentation(request, pres.id);
  });

  test('theme toggle switches between dark and light', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();

    const initialTheme = await home.getTheme();
    await home.toggleTheme();
    const newTheme = await home.getTheme();
    expect(newTheme).not.toBe(initialTheme);

    await home.toggleTheme();
    const restoredTheme = await home.getTheme();
    expect(restoredTheme).toBe(initialTheme);
  });

  test('can navigate to Settings page', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.navigateToSettings();

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
  });

  test('can navigate to Explore page', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.navigateToExplore();

    await expect(page.locator('h1:has-text("Explore")')).toBeVisible();
  });
});
