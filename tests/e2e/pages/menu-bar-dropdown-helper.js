import { expect } from '@playwright/test'

const TRIGGER_SELECTOR = {
  File: '[aria-label="File menu"]',
  AI: '[aria-label="AI"]',
  Share: '[aria-label="Share"]',
}

export class MenuBarDropdownHelper {
  constructor({ page }) {
    this.page = page
  }

  async openMenuItem(triggerName, itemLabel, { exact = false } = {}) {
    const trigger = TRIGGER_SELECTOR[triggerName]
    if (!trigger) throw new Error(`Unknown menu trigger "${triggerName}"`)
    await this.page.locator(trigger).click()
    const menuitem = this.page.getByRole('menuitem', { name: itemLabel, exact })
    await menuitem.first().click()
  }

  async openFileMenuItem(itemName) {
    await this.openMenuItem('File', itemName)
  }

  async openSyncModal() {
    await this.openFileMenuItem('Sync to Cloud')
    await expect(this.page.getByRole('dialog', { name: 'Sync to Cloud' })).toBeVisible()
  }

  async openHistoryModal() {
    await this.openFileMenuItem('Version History')
    await expect(this.page.getByRole('dialog', { name: 'Version History' })).toBeVisible()
  }

  async openShareModal() {
    await this.openMenuItem('Share', 'Share Link', { exact: true })
    await expect(this.page.getByRole('dialog', { name: 'Share Presentation' })).toBeVisible()
  }

  async openAICopywriter() {
    await this.openMenuItem('AI', 'AI Copywriter')
    await expect(this.page.getByRole('dialog', { name: 'AI Copywriter' })).toBeVisible()
  }

  async openAISlideGenerator() {
    await this.openMenuItem('AI', 'AI Slide Generator')
    await expect(this.page.getByRole('dialog', { name: 'AI Slide Generator' })).toBeVisible()
  }

  async openAITranslate() {
    await this.openMenuItem('AI', 'Translate')
    await expect(this.page.getByRole('dialog', { name: 'Translate Presentation' })).toBeVisible()
  }

  async startBroadcast() {
    await this.openMenuItem('Share', 'Present Live')
    await expect(this.page.getByRole('dialog', { name: 'Present Live' })).toBeVisible()
  }

  async openAnalytics() {
    await this.openMenuItem('Share', 'View Analytics')
  }

  async exportHTML() {
    await this.openFileMenuItem('Export HTML')
  }

  async exportPDF() {
    await this.openFileMenuItem('Export PDF')
  }

  async exportPPTX() {
    await this.openFileMenuItem('Export PPTX')
  }

  async exportOffline() {
    await this.openFileMenuItem('Export Offline HTML')
  }

  async exportProject() {
    await this.openFileMenuItem('Export Project')
  }

  async pushToGithub() {
    await this.openFileMenuItem('Save to GitHub')
  }

  async openProject() {
    await this.openFileMenuItem('Open Project')
  }
}
