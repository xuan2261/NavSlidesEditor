import { expect } from '@playwright/test'
import { CanvasHelper } from './CanvasHelper.js'
import { RibbonInsertHelper } from './RibbonInsertHelper.js'
import { PropertiesPanelHelper } from './PropertiesPanelHelper.js'
import { SlidePanelHelper } from './SlidePanelHelper.js'
import { RibbonTabToolbarHelper } from './ribbon-tab-toolbar-helper.js'
import { MenuBarDropdownHelper } from './menu-bar-dropdown-helper.js'
import { TextEditorProseMirrorHelper } from './text-editor-prosemirror-and-find-replace-helper.js'

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
    this.ribbon = new RibbonTabToolbarHelper({ page })
    this.menubar = new MenuBarDropdownHelper({ page })
    this.insert = new RibbonInsertHelper({
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
    this.text = new TextEditorProseMirrorHelper({
      page,
      elementsCountLocator: this.elementsCountLocator,
      getElementCount: () => this.getElementCount(),
      getLastInsertedElementIndex: () => this.lastInsertedElementIndex,
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

  async waitForElementPanelSelected(t = 5000) { await this.properties.waitForElementPanelSelected(t) }
  async waitForElementPanelCleared(t = 5000) { await this.properties.waitForElementPanelCleared(t) }

  async gotoPresentation(id) {
    await this.page.addInitScript(() => {
      window.localStorage.setItem('navSlidesTutorialSeen', 'true')
    })
    await this.page.goto(`/editor/${id}`, { timeout: 30000 })
    await this.waitForReady()
  }

  async getElementCount() { return this.elementsCountLocator.count() }
  async getSlideCount() { return this.thumbnailsLocator.count() }

  async overridePromptDialog(mockValue = '3') {
    this.page.on('dialog', (dialog) => dialog.accept(mockValue))
  }

  async addToolbarElement(buttonTitle) {
    const titleToTab = {
      'Slide Background': { tab: 'Design', title: 'Slide background' },
    }
    const target = titleToTab[buttonTitle] || { tab: 'Insert', title: buttonTitle }
    await this.page.getByRole('tab', { name: target.tab }).click()
    await this.page.locator(`button[title="${target.title}"]`).click()
  }

  async clickInsertMenuItem(name) { await this.insert.clickInsertMenuItem(name) }
  async openFileMenuItem(name) { await this.menubar.openFileMenuItem(name) }
  async openSyncModal() { await this.menubar.openSyncModal() }
  async openHistoryModal() { await this.menubar.openHistoryModal() }

  async closeOverlayModal() {
    await this.page.locator('.fixed.inset-0').last().click({ position: { x: 10, y: 10 } })
  }

  async openTemplateGallery() {
    await this.page.locator('button').filter({ hasText: 'Insert Template' }).click()
    await this.page.waitForSelector('h2:has-text("Template Gallery")', { timeout: 5000 })
  }

  async addTextNode() { return this.insert.addTextNode() }

  async startEditingTextElement(i) { await this.text.startEditingTextElement(i) }
  async typeInTextEditor(t) { await this.text.typeInTextEditor(t) }
  async selectAllText() { await this.text.selectAllText() }
  async getTextEditorState() { return this.text.getTextEditorState() }
  async openFindReplace() { await this.text.openFindReplace() }
  async closeFindReplace() { await this.text.closeFindReplace() }
  async findText(t) { await this.text.findText(t) }
  async replaceText(s, r) { await this.text.replaceText(s, r) }
  async replaceAll() { await this.text.replaceAll() }
  async getMatchCount() { return this.text.getMatchCount() }

  async clickMainToolbarButton(t) { await this.ribbon.clickMainToolbarButton(t) }
  async chooseMainToolbarOption(t, v) { await this.ribbon.chooseMainToolbarOption(t, v) }
  async clickQuickAccessSave() { await this.ribbon.clickQuickAccessSave() }
  async getToolbarOverflowMetrics() { return this.ribbon.getToolbarOverflowMetrics() }
  async switchRibbonTab(name) { await this.ribbon.switchRibbonTab(name) }
  async getRibbonLayoutMetrics(name) { return this.ribbon.getRibbonLayoutMetrics(name) }
  async getButtonClippingStatus(labels) { return this.ribbon.getButtonClippingStatus(labels) }

  async addShape(t) { await this.insert.addShape(t) }
  async addCodeBlock() { await this.insert.addCodeBlock() }
  async addLatexBlock() { await this.insert.addLatexBlock() }
  async addMarkdownBlock() { await this.insert.addMarkdownBlock() }
  async addChart() { await this.insert.addChart() }
  async addCallout() { await this.insert.addCallout() }
  async addHtmlEmbed() { await this.insert.addHtmlEmbed() }
  async addDrawing() { await this.insert.addDrawing() }
  async addLine() { await this.insert.addLine() }
  async addTable(rows = 3, cols = 3) { await this.insert.addTable(rows, cols) }
  async openMediaLibrary() { await this.insert.openMediaLibrary() }

  async addSlide() { await this.slidePanel.addSlide() }
  async addSlideFromTemplate(t) { await this.slidePanel.addSlideFromTemplate(t) }
  async deleteSlide(i = 0) { await this.slidePanel.deleteSlide(i) }
  async selectSlide(i) { await this.slidePanel.selectSlide(i) }
  async toggleSlideSelection(i) { await this.slidePanel.toggleSlideSelection(i) }
  async duplicateSelectedSlides() { await this.slidePanel.duplicateSelectedSlides() }
  async deleteSelectedSlides() { await this.slidePanel.deleteSelectedSlides() }

  async openShareModal() { await this.menubar.openShareModal() }
  async openAICopywriter() { await this.menubar.openAICopywriter() }
  async startBroadcast() { await this.menubar.startBroadcast() }
  async exportHTML() { await this.menubar.exportHTML() }

  async selectElement(i = 0) { await this.canvas.selectElement(i) }
  async deleteSelectedElement() { await this.canvas.deleteSelectedElement() }
  async undo() { await this.canvas.undo() }
  async redo() { await this.canvas.redo() }
  async duplicateElement() { await this.canvas.duplicateElement() }
  async copyElement() { await this.canvas.copyElement() }
  async pasteElement() { await this.canvas.pasteElement() }
  async deselectAll() { await this.canvas.deselectAll() }

  async openPresentMode() { await this.page.click('button[title="Present"]') }
  async isPropertiesPanelVisible() { return this.properties.isPropertiesPanelVisible() }

  async changeBackgroundToGradient() {
    await this.addToolbarElement('Slide Background')
    await expect(this.page.getByText('Slide Background')).toBeVisible()

    const initialBgColor = await this.page.evaluate(() => {
      const el = document.querySelector('.slide-canvas')
      return el ? window.getComputedStyle(el).backgroundColor : ''
    })

    await this.page.getByRole('button', { name: 'gradient' }).click()
    const swatches = this.page.getByRole('button', { name: /^Gradient / }).filter({ visible: true })
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
}
