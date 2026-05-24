import { expect } from '@playwright/test'

export class SlidePanelHelper {
  constructor({ page, thumbnailsLocator, addSlideBtn, waitForSlideCount }) {
    this.page = page
    this.thumbnailsLocator = thumbnailsLocator
    this.addSlideBtn = addSlideBtn
    this.waitForSlideCount = waitForSlideCount
  }

  async getSlideCount() {
    return await this.thumbnailsLocator.count()
  }

  async addSlide() {
    const prevCount = await this.getSlideCount()
    await this.addSlideBtn.click()
    await this.page.waitForSelector('h2:has-text("Add Slide")')
    await this.page.locator('button').filter({ hasText: 'Blank' }).click()
    await this.waitForSlideCount(prevCount + 1)
  }

  async addSlideFromTemplate(templateName) {
    const prevCount = await this.getSlideCount()
    await this.addSlideBtn.click()
    await this.page.waitForSelector('.fixed.inset-0 h2:has-text("Add Slide")')
    await this.page.locator('.fixed.inset-0 button').filter({ hasText: templateName }).click()
    await this.waitForSlideCount(prevCount + 1)
  }

  async deleteSlide(index = 0) {
    const prevCount = await this.getSlideCount()
    const slideItem = this.thumbnailsLocator.nth(index)
    await slideItem.hover()
    await slideItem.locator('button[title="Delete"]').click()
    await this.waitForSlideCount(prevCount - 1)
  }

  async selectSlide(index) {
    const slide = this.thumbnailsLocator.nth(index)
    await slide.click()
    await expect(slide).toHaveClass(/border-accent/, { timeout: 5000 })
  }

  async toggleSlideSelection(index) {
    const slide = this.thumbnailsLocator.nth(index)
    await slide.click({ modifiers: ['ControlOrMeta'] })
  }

  async duplicateSelectedSlides() {
    await this.page.locator('.slide-panel button[title="Duplicate all selected"]').click()
  }

  async deleteSelectedSlides() {
    await this.page.locator('.slide-panel button[title="Delete all selected"]').click()
  }
}
