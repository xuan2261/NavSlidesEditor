import { expect } from '@playwright/test'

export class CanvasHelper {
  constructor({
    page,
    elementsCountLocator,
    waitForElementCount,
    waitForElementPanelSelected,
    waitForElementPanelCleared,
  }) {
    this.page = page
    this.elementsCountLocator = elementsCountLocator
    this.waitForElementCount = waitForElementCount
    this.waitForElementPanelSelected = waitForElementPanelSelected
    this.waitForElementPanelCleared = waitForElementPanelCleared
  }

  async selectElement(index = 0) {
    await this.elementsCountLocator.nth(index).click()
    await this.waitForElementPanelSelected()
  }

  async deleteSelectedElement() {
    const prevCount = await this.elementsCountLocator.count()
    await this.page.keyboard.press('Delete')
    await this.waitForElementCount(prevCount - 1)
  }

  async undo() {
    await this.page.keyboard.press('Control+z')
    await expect(this.page.locator('.slide-canvas')).toBeVisible()
  }

  async redo() {
    await this.page.keyboard.press('Control+y')
    await expect(this.page.locator('.slide-canvas')).toBeVisible()
  }

  async duplicateElement() {
    const prevCount = await this.elementsCountLocator.count()
    await this.page.keyboard.press('Control+d')
    await this.waitForElementCount(prevCount + 1)
  }

  async copyElement() {
    await this.page.keyboard.press('Control+c')
    await expect(this.page.locator('.slide-canvas')).toBeVisible()
  }

  async pasteElement() {
    const prevCount = await this.elementsCountLocator.count()
    await this.page.keyboard.press('Control+v')
    await this.waitForElementCount(prevCount + 1)
  }

  async deselectAll() {
    await this.page.keyboard.press('Escape')
    await this.waitForElementPanelCleared()
  }
}
