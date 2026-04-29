import { expect } from '@playwright/test'

export class PropertiesPanelHelper {
  constructor({ page }) {
    this.page = page
  }

  async waitForElementPanelSelected(timeout = 5000) {
    await expect(this.page.locator('.properties-panel h3').filter({ hasText: 'Element' })).toBeVisible({
      timeout,
    })
  }

  async waitForElementPanelCleared(timeout = 5000) {
    await expect(this.page.locator('.properties-panel h3').filter({ hasText: 'Element' })).toHaveCount(
      0,
      { timeout }
    )
  }

  async isPropertiesPanelVisible() {
    return this.page.locator('.properties-panel').isVisible()
  }
}
