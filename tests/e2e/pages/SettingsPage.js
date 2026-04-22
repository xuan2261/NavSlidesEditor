export class SettingsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
    this.saveBtn = page.locator('button:has-text("Save")')
    this.backBtn = page.locator('button').first()
    this.providerSelect = page.locator('select').first()
    this.testConnectionBtn = page.locator('button:has-text("Test Connection")')
  }

  async goto() {
    await this.page.goto('/settings', { timeout: 30000 })
    await this.page.waitForSelector('h1:has-text("Settings")', { timeout: 30000 })
  }

  async selectProvider(provider) {
    await this.providerSelect.selectOption(provider)
  }

  async save() {
    await this.saveBtn.click()
    // Wait for save confirmation
    await this.page
      .waitForSelector('span:has-text("Settings saved!")', { timeout: 5000 })
      .catch(() => {})
  }

  async goBack() {
    await this.backBtn.click()
    await this.page.waitForURL('/', { timeout: 10000 })
  }

  async getDefaultTheme() {
    return this.page.locator('select').nth(1).inputValue()
  }

  async setDefaultTheme(theme) {
    await this.page.locator('select').nth(1).selectOption(theme)
  }

  async setDefaultTransition(transition) {
    await this.page.locator('select').nth(2).selectOption(transition)
  }
}
