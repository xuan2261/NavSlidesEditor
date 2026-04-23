import { expect } from '@playwright/test'

export class HomePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
    this.newPresentationBtn = page.locator('button:has-text("New")').first()
    this.modalTitleInput = page.locator('input[placeholder="My Presentation"]')
    this.modalCreateBtn = page.locator('.fixed.inset-0 button:has-text("Create")')
    this.searchInput = page.locator('input[placeholder="Search presentations..."]')
    this.presentationCards = page.locator('.bg-card.group')
  }

  async goto() {
    await this.page.goto('/', { timeout: 30000 })
    // Chờ Vite compile và render react app
    await this.page.waitForSelector('.bg-panel', { timeout: 30000 })
  }

  async createNewPresentation(title = 'E2E Automated Presentation') {
    await this.newPresentationBtn.click()
    await this.modalTitleInput.waitFor({ state: 'visible', timeout: 30000 })
    await this.modalTitleInput.fill(title)
    await this.modalCreateBtn.click()
    // Chờ route chuyển sang /editor/:id
    await this.page.waitForURL(/\/editor\/.+/, { timeout: 30000 })
  }

  // ── New methods for extended coverage ──

  async searchPresentation(query) {
    await this.searchInput.fill(query)
    await expect(this.searchInput).toHaveValue(query)
  }

  async clearSearch() {
    await this.searchInput.fill('')
    await expect(this.searchInput).toHaveValue('')
  }

  async getPresentationCount() {
    return this.presentationCards.count()
  }

  async switchSidebarView(viewLabel) {
    const button = this.page.locator('button').filter({ hasText: viewLabel })
    await button.click()
    await expect(button).toBeVisible()
  }

  async navigateToSettings() {
    await this.page.locator('button[title="Settings"]').click()
    await this.page.waitForURL('/settings', { timeout: 10000 })
  }

  async navigateToExplore() {
    await this.page.locator('button').filter({ hasText: 'Explore' }).click()
    await this.page.waitForURL('/explore', { timeout: 10000 })
  }

  async duplicatePresentation(index = 0) {
    const prevCount = await this.getPresentationCount()
    const card = this.presentationCards.nth(index)
    await card.hover()
    await card.locator('button[title="Duplicate"]').click()
    await expect(this.presentationCards).toHaveCount(prevCount + 1, { timeout: 10000 })
  }

  async deletePresentation(index = 0) {
    this.page.on('dialog', (dialog) => dialog.accept())
    const prevCount = await this.getPresentationCount()
    const card = this.presentationCards.nth(index)
    await card.hover()
    await card.locator('button[title="Delete"]').click()
    await expect(this.presentationCards).toHaveCount(prevCount - 1, { timeout: 10000 })
  }

  async openPresentation(index = 0) {
    await this.presentationCards.nth(index).click()
    await this.page.waitForURL(/\/editor\/.+/, { timeout: 30000 })
  }

  async toggleTheme() {
    const previousTheme = await this.getTheme()
    const btn = this.page.locator('button[title*="Switch to"]')
    await btn.click()
    await expect
      .poll(async () => this.getTheme(), { timeout: 5000 })
      .not.toBe(previousTheme)
  }

  async getTheme() {
    return this.page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  }

  async switchToGridView() {
    // Grid view button might have title attribute
    const gridBtn = this.page.locator('button[title="Grid view"]')
    if (await gridBtn.isVisible()) await gridBtn.click()
  }

  async switchToListView() {
    const listBtn = this.page.locator('button[title="List view"]')
    if (await listBtn.isVisible()) await listBtn.click()
  }

  async createFromPresetTemplate(templateName) {
    await this.switchSidebarView('Built-in')
    await this.page.locator('.bg-card.group').filter({ hasText: templateName }).click()
    await this.page.waitForURL(/\/editor\/.+/, { timeout: 30000 })
  }

  async restoreFromTrash(index = 0) {
    const prevCount = await this.getPresentationCount()
    const card = this.presentationCards.nth(index)
    await card.locator('button[title="Restore"]').click()
    await expect(this.presentationCards).toHaveCount(prevCount - 1, { timeout: 10000 })
  }

  async permanentDeleteFromTrash(index = 0) {
    this.page.on('dialog', (dialog) => dialog.accept())
    const prevCount = await this.getPresentationCount()
    const card = this.presentationCards.nth(index)
    await card.locator('button[title="Delete permanently"]').click()
    await expect(this.presentationCards).toHaveCount(prevCount - 1, { timeout: 10000 })
  }
}
