import { expect } from '@playwright/test'

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
  }

  async waitForReady() {
    await this.page.waitForSelector('.slide-canvas', { timeout: 30000 })
  }

  async waitForAutoSave() {
    await this.page
      .getByText('Saving...', { exact: true })
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {})
    await expect(this.page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10000 })
  }

  async waitForElementCount(expectedCount, timeout = 5000) {
    await expect(this.elementsCountLocator).toHaveCount(expectedCount, { timeout })
  }

  async waitForSlideCount(expectedCount, timeout = 5000) {
    await expect(this.thumbnailsLocator).toHaveCount(expectedCount, { timeout })
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
    const insertMenuOpen = await this.page
      .locator('.insert-dropdown')
      .isVisible()
      .catch(() => false)
    if (!insertMenuOpen) {
      await this.page.click('button.insert-trigger:has-text("Insert")')
      await this.page.waitForSelector('.insert-dropdown', { state: 'visible' })
    }
    await this.page.locator('.insert-dropdown .insert-item').filter({ hasText: itemName }).click()
  }

  async openFileMenuItem(itemName) {
    await this.page.click('button.menu-trigger:has-text("File")')
    await this.page.locator('.dropdown-item').filter({ hasText: itemName }).click()
  }

  async openSyncModal() {
    await this.openFileMenuItem('Sync to Cloud')
    await this.page.waitForSelector('h3:has-text("Sync to Cloud")', { timeout: 5000 })
  }

  async openHistoryModal() {
    await this.openFileMenuItem('Version History')
    await this.page.waitForSelector('h3:has-text("Version History")', { timeout: 5000 })
  }

  async closeOverlayModal() {
    await this.page.locator('.fixed.inset-0').last().click({ position: { x: 10, y: 10 } })
  }

  async openTemplateGallery() {
    await this.page.locator('button').filter({ hasText: 'Insert Template' }).click()
    await this.page.waitForSelector('h2:has-text("Template Gallery")', { timeout: 5000 })
  }

  async addTextNode() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Text')
    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.element-wrapper').length > prev
      },
      prevCount,
      { timeout: 5000 }
    )
    this.lastInsertedElementIndex = (await this.getElementCount()) - 1
    return this.lastInsertedElementIndex
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
    const prevCount = await this.getElementCount()
    const insertMenuOpen = await this.page
      .locator('.insert-dropdown')
      .isVisible()
      .catch(() => false)
    if (!insertMenuOpen) {
      await this.page.click('button.insert-trigger:has-text("Insert")')
      await this.page.waitForSelector('.insert-dropdown', { state: 'visible' })
    }
    await this.page.locator('.insert-dropdown .insert-item').filter({ hasText: 'Shape' }).click()
    await this.page.waitForSelector('.insert-sub-panel.shape-picker-grid', { state: 'visible' })
    await this.page.click(`button.shape-pick-btn[title="${shapeTitle}"]`)
    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.element-wrapper').length > prev
      },
      prevCount,
      { timeout: 5000 }
    )
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
    // Hover slide then click delete button inside it
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

  async openMediaLibrary() {
    await this.clickInsertMenuItem('Media Library')
    await this.page.waitForSelector('h2:has-text("Media Library")')
  }

  async openShareModal() {
    await this.page.click('button.menu-trigger:has-text("Share")')
    await this.page.locator('.dropdown-item').filter({ hasText: 'Share Link' }).click()
    await this.page.waitForSelector('h3:has-text("Share Presentation")')
  }

  async openAICopywriter() {
    await this.page.click('button.menu-trigger:has-text("AI")')
    await this.page.locator('.dropdown-item').filter({ hasText: 'AI Copywriter' }).click()
    await this.page.waitForSelector('h3:has-text("AI Copywriter")')
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
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Code Block')
    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.element-wrapper').length > prev
      },
      prevCount,
      { timeout: 5000 }
    )
  }

  async addLatexBlock() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('LaTeX / TikZ')
    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.element-wrapper').length > prev
      },
      prevCount,
      { timeout: 5000 }
    )
  }

  async addMarkdownBlock() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Markdown')
    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.element-wrapper').length > prev
      },
      prevCount,
      { timeout: 5000 }
    )
  }

  async addChart() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Chart')
    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.element-wrapper').length > prev
      },
      prevCount,
      { timeout: 5000 }
    )
  }

  async addCallout() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Callout')
    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.element-wrapper').length > prev
      },
      prevCount,
      { timeout: 5000 }
    )
  }

  async addHtmlEmbed() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Embed HTML')
    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.element-wrapper').length > prev
      },
      prevCount,
      { timeout: 5000 }
    )
  }

  async addDrawing() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Drawing Canvas')
    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.element-wrapper').length > prev
      },
      prevCount,
      { timeout: 5000 }
    )
  }

  async addLine() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Line / Arrow')
    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.element-wrapper').length > prev
      },
      prevCount,
      { timeout: 5000 }
    )
  }

  async addTable(rows = 3, cols = 3) {
    const prevCount = await this.getElementCount()
    const insertMenuOpen = await this.page
      .locator('.insert-dropdown')
      .isVisible()
      .catch(() => false)
    if (!insertMenuOpen) {
      await this.page.click('button.insert-trigger:has-text("Insert")')
      await this.page.waitForSelector('.insert-dropdown', { state: 'visible' })
    }
    await this.page.locator('.insert-dropdown .insert-item').filter({ hasText: 'Table' }).hover()
    await this.page.waitForSelector('.table-size-picker', { state: 'visible' })

    // Click preset button to set size, then click Insert button
    await this.page.locator(`.table-size-picker button`).filter({ hasText: `${rows}×${cols}` }).first().click()
    await this.page.locator('.table-size-picker button').filter({ hasText: /Insert.*Table/ }).click()

    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.element-wrapper').length > prev
      },
      prevCount,
      { timeout: 5000 }
    )
  }

  async selectElement(index = 0) {
    await this.elementsCountLocator.nth(index).click()
    await this.waitForElementPanelSelected()
  }

  async deleteSelectedElement() {
    const prevCount = await this.getElementCount()
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
    const prevCount = await this.getElementCount()
    await this.page.keyboard.press('Control+d')
    await this.waitForElementCount(prevCount + 1)
  }

  async copyElement() {
    await this.page.keyboard.press('Control+c')
    await expect(this.page.locator('.slide-canvas')).toBeVisible()
  }

  async pasteElement() {
    const prevCount = await this.getElementCount()
    await this.page.keyboard.press('Control+v')
    await this.waitForElementCount(prevCount + 1)
  }

  async deselectAll() {
    await this.page.keyboard.press('Escape')
    await this.waitForElementPanelCleared()
  }

  async exportHTML() {
    await this.page.click('button.menu-trigger:has-text("File")')
    await this.page.locator('.dropdown-item').filter({ hasText: 'Export HTML' }).click()
  }

  async openPresentMode() {
    await this.page.click('button[title="Present"]')
  }

  async isPropertiesPanelVisible() {
    return this.page.locator('.properties-panel').isVisible()
  }
}
