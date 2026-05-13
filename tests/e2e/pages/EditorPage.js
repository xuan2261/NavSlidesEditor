import { expect } from '@playwright/test'
import { CanvasHelper } from './CanvasHelper.js'
import { InsertMenuHelper } from './InsertMenuHelper.js'
import { PropertiesPanelHelper } from './PropertiesPanelHelper.js'
import { SlidePanelHelper } from './SlidePanelHelper.js'

export class EditorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page
    this.canvasLocator = page.locator('.slide-canvas')
    this.elementsCountLocator = page.locator('.element-wrapper')
    this.thumbnailsLocator = page.locator('.slide-panel .slide-item')
    this.addSlideBtn = page.locator('.add-slide-btn').filter({ hasText: 'Add Slide' })
    this.lastInsertedElementIndex = null

    this.properties = new PropertiesPanelHelper({ page })
    this.insert = new InsertMenuHelper({
      page,
      getElementCount: () => this.getElementCount(),
      setLastInsertedElementIndex: (index) => {
        this.lastInsertedElementIndex = index
      },
    })
    this.slidePanel = new SlidePanelHelper({
      page,
      thumbnailsLocator: this.thumbnailsLocator,
      addSlideBtn: this.addSlideBtn,
      waitForSlideCount: (expectedCount, timeout) => this.waitForSlideCount(expectedCount, timeout),
    })
    this.canvas = new CanvasHelper({
      page,
      elementsCountLocator: this.elementsCountLocator,
      waitForElementCount: (expectedCount, timeout) => this.waitForElementCount(expectedCount, timeout),
      waitForElementPanelSelected: (timeout) => this.waitForElementPanelSelected(timeout),
      waitForElementPanelCleared: (timeout) => this.waitForElementPanelCleared(timeout),
    })
  }

  async waitForReady() {
    await this.page.waitForSelector('.slide-canvas', { timeout: 30000 })
  }

  async waitForAutoSave() {
    const savingBadge = this.page.getByText('Saving...', { exact: true })
    await this.page
      .getByText('Saving...', { exact: true })
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {})
    await expect(savingBadge).toHaveCount(0, { timeout: 10000 })
  }

  async waitForElementCount(expectedCount, timeout = 5000) {
    await expect(this.elementsCountLocator).toHaveCount(expectedCount, { timeout })
  }

  async waitForSlideCount(expectedCount, timeout = 5000) {
    await expect(this.thumbnailsLocator).toHaveCount(expectedCount, { timeout })
  }

  async waitForElementPanelSelected(timeout = 5000) {
    await this.properties.waitForElementPanelSelected(timeout)
  }

  async waitForElementPanelCleared(timeout = 5000) {
    await this.properties.waitForElementPanelCleared(timeout)
  }

  async gotoPresentation(id) {
    await this.page.addInitScript(() => {
      window.localStorage.setItem('navSlidesTutorialSeen', 'true')
    })
    await this.page.goto(`/editor/${id}`, { timeout: 30000 })
    await this.waitForReady()
  }

  async getElementCount() {
    return await this.elementsCountLocator.count()
  }

  async getSlideCount() {
    return await this.thumbnailsLocator.count()
  }

  async overridePromptDialog(mockValue = '3') {
    // Override default prompt handling
    this.page.on('dialog', (dialog) => dialog.accept(mockValue))
  }

  async addToolbarElement(buttonTitle) {
    await this.page.click(`button[title="${buttonTitle}"]`)
  }

  async clickInsertMenuItem(itemName) {
    await this.insert.clickInsertMenuItem(itemName)
  }

  async openFileMenuItem(itemName) {
    await this.page.click('button.menu-trigger:has-text("File")')
    await this.page.locator('.dropdown-item').filter({ hasText: itemName }).click()
  }

  async openSyncModal() {
    await this.openFileMenuItem('Sync to Cloud')
    await expect(this.page.getByRole('dialog', { name: 'Sync to Cloud' })).toBeVisible()
  }

  async openHistoryModal() {
    await this.openFileMenuItem('Version History')
    await expect(this.page.getByRole('dialog', { name: 'Version History' })).toBeVisible()
  }

  async closeOverlayModal() {
    await this.page.locator('.fixed.inset-0').last().click({ position: { x: 10, y: 10 } })
  }

  async openTemplateGallery() {
    await this.page.locator('button').filter({ hasText: 'Insert Template' }).click()
    await this.page.waitForSelector('h2:has-text("Template Gallery")', { timeout: 5000 })
  }

  async addTextNode() {
    return await this.insert.addTextNode()
  }

  async startEditingTextElement(index = this.lastInsertedElementIndex ?? -1) {
    const count = await this.getElementCount()
    const resolvedIndex = index < 0 ? count + index : index
    if (resolvedIndex < 0 || resolvedIndex >= count) {
      throw new Error(`No element wrapper at index ${index}`)
    }

    const element = this.elementsCountLocator.nth(resolvedIndex)
    await element.scrollIntoViewIfNeeded()
    await element.click({ force: true })
    await element.dblclick({ force: true })
    await this.page.waitForSelector('.ProseMirror', { timeout: 5000 })
  }

  async typeInTextEditor(text) {
    await this.page.locator('.ProseMirror').click({ force: true })
    await this.page.keyboard.type(text)
  }

  async selectAllText() {
    await this.page.locator('.ProseMirror').click({ force: true })
    await this.page.keyboard.press('Control+a')
  }

  async clickMainToolbarButton(title) {
    await this.page.locator(`.tour-step-toolbar button[title="${title}"]`).click()
  }

  async chooseMainToolbarOption(title, value) {
    const select = this.page.locator(`.tour-step-toolbar select[title="${title}"]`)
    await select.click({ force: true })
    await select.selectOption(value)
  }

  async clickQuickAccessSave() {
    await this.page.locator('button[title*="Save"]').first().click()
  }

  async getTextEditorState() {
    return this.page.evaluate(() => ({
      proseMirrorCount: document.querySelectorAll('.ProseMirror').length,
      proseMirrorFocused: !!document.querySelector('.ProseMirror-focused'),
      toolbarHintVisible:
        document.querySelector('.tour-step-toolbar')?.textContent?.includes(
          'Double-click a text box to edit'
        ) || false,
      html: document.querySelector('.ProseMirror')?.innerHTML || '',
      strongCount: document.querySelectorAll('.ProseMirror strong').length,
      firstStyledSpan: (() => {
        const span = document.querySelector('.ProseMirror span[style]')
        return span
          ? {
              fontFamily: span.style.fontFamily || '',
              fontSize: span.style.fontSize || '',
            }
          : null
      })(),
    }))
  }

  async getToolbarOverflowMetrics() {
    return this.page.evaluate(() => {
      const toolbar = document.querySelector('.tour-step-toolbar')
      if (!toolbar) return null
      const rect = toolbar.getBoundingClientRect()
      const overflowChildren = Array.from(toolbar.children).filter((node) => {
        const childRect = node.getBoundingClientRect()
        return childRect.bottom > rect.bottom + 0.5
      }).length

      return {
        height: rect.height,
        width: rect.width,
        scrollHeight: toolbar.scrollHeight,
        scrollWidth: toolbar.scrollWidth,
        overflowChildren,
      }
    })
  }

  async addShape(shapeTitle) {
    await this.insert.addShape(shapeTitle)
  }

  async addSlide() {
    await this.slidePanel.addSlide()
  }

  async addSlideFromTemplate(templateName) {
    await this.slidePanel.addSlideFromTemplate(templateName)
  }

  async deleteSlide(index = 0) {
    await this.slidePanel.deleteSlide(index)
  }

  async selectSlide(index) {
    await this.slidePanel.selectSlide(index)
  }

  async toggleSlideSelection(index) {
    await this.slidePanel.toggleSlideSelection(index)
  }

  async duplicateSelectedSlides() {
    await this.slidePanel.duplicateSelectedSlides()
  }

  async deleteSelectedSlides() {
    await this.slidePanel.deleteSelectedSlides()
  }

  async openMediaLibrary() {
    await this.insert.openMediaLibrary()
  }

  async openShareModal() {
    await this.page.click('button.menu-trigger:has-text("Share")')
    await this.page.locator('.dropdown-item').filter({ hasText: 'Share Link' }).click()
    await expect(this.page.getByRole('dialog', { name: 'Share Presentation' })).toBeVisible()
  }

  async openAICopywriter() {
    await this.page.click('button.menu-trigger:has-text("AI")')
    await this.page.locator('.dropdown-item').filter({ hasText: 'AI Copywriter' }).click()
    await expect(this.page.getByRole('dialog', { name: 'AI Copywriter' })).toBeVisible()
  }

  async startBroadcast() {
    await this.page.click('button.menu-trigger:has-text("Share")')
    await this.page.locator('.dropdown-item').filter({ hasText: 'Present Live' }).click()
    await this.page.waitForSelector('h3:has-text("Present Live")')
  }

  async changeBackgroundToGradient() {
    await this.addToolbarElement('Slide Background')
    await this.page.waitForSelector('.bg-popup-container')

    const initialBgColor = await this.page.evaluate(() => {
      const el = document.querySelector('.slide-canvas')
      return el ? window.getComputedStyle(el).backgroundColor : ''
    })

    await this.page.click('.bg-type-tab:has-text("Gradient")')
    const swatches = this.page.locator('.bg-popup-container div[title^="linear-gradient"]')
    if ((await swatches.count()) > 0) {
      await swatches.nth(1).click()
      await this.page
        .waitForFunction(
          (initial) => {
            const el = document.querySelector('.slide-canvas')
            return el && window.getComputedStyle(el).backgroundColor !== initial
          },
          initialBgColor,
          { timeout: 5000 }
        )
        .catch(() => {})
    }
  }

  // ── New methods for extended coverage ──

  async openFindReplace() {
    await this.page.keyboard.press('Control+f')
    await this.page.waitForSelector('.find-replace-bar', { timeout: 5000 })
  }

  async closeFindReplace() {
    await this.page.keyboard.press('Escape')
    await this.page
      .waitForSelector('.find-replace-bar', { state: 'hidden', timeout: 5000 })
      .catch(() => {})
  }

  async findText(text) {
    await this.openFindReplace()
    const input = this.page.locator('.find-input').first()
    await input.fill(text)
    await expect(input).toHaveValue(text)
  }

  async replaceText(searchText, replaceText) {
    await this.findText(searchText)
    // Toggle replace panel
    await this.page.locator('.find-btn[title="Toggle replace"]').click()
    const replaceInput = this.page.locator('input[placeholder="Replace..."]')
    await replaceInput.fill(replaceText)
  }

  async replaceAll() {
    await this.page.locator('.find-replace-bar button').filter({ hasText: 'All' }).click()
  }

  async getMatchCount() {
    const countText = await this.page.locator('.find-count').textContent()
    if (countText === '0') return 0
    const parts = countText.split('/')
    return parts.length === 2 ? parseInt(parts[1]) : 0
  }

  async addCodeBlock() {
    await this.insert.addCodeBlock()
  }

  async addLatexBlock() {
    await this.insert.addLatexBlock()
  }

  async addMarkdownBlock() {
    await this.insert.addMarkdownBlock()
  }

  async addChart() {
    await this.insert.addChart()
  }

  async addCallout() {
    await this.insert.addCallout()
  }

  async addHtmlEmbed() {
    await this.insert.addHtmlEmbed()
  }

  async addDrawing() {
    await this.insert.addDrawing()
  }

  async addLine() {
    await this.insert.addLine()
  }

  async addTable(rows = 3, cols = 3) {
    await this.insert.addTable(rows, cols)
  }

  async selectElement(index = 0) {
    await this.canvas.selectElement(index)
  }

  async deleteSelectedElement() {
    await this.canvas.deleteSelectedElement()
  }

  async undo() {
    await this.canvas.undo()
  }

  async redo() {
    await this.canvas.redo()
  }

  async duplicateElement() {
    await this.canvas.duplicateElement()
  }

  async copyElement() {
    await this.canvas.copyElement()
  }

  async pasteElement() {
    await this.canvas.pasteElement()
  }

  async deselectAll() {
    await this.canvas.deselectAll()
  }

  async exportHTML() {
    await this.page.click('button.menu-trigger:has-text("File")')
    await this.page.locator('.dropdown-item').filter({ hasText: 'Export HTML' }).click()
  }

  async openPresentMode() {
    await this.page.click('button[title="Present"]')
  }

  async isPropertiesPanelVisible() {
    return await this.properties.isPropertiesPanelVisible()
  }
}
