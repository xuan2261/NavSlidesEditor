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
  }

  async waitForReady() {
    await this.page.waitForSelector('.slide-canvas', { timeout: 30000 })
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
    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.slide-panel .slide-item').length > prev
      },
      prevCount,
      { timeout: 5000 }
    )
  }

  async addSlideFromTemplate(templateName) {
    const prevCount = await this.getSlideCount()
    await this.addSlideBtn.click()
    await this.page.waitForSelector('.fixed.inset-0 h2:has-text("Add Slide")')
    await this.page.locator('.fixed.inset-0 button').filter({ hasText: templateName }).click()
    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.slide-panel .slide-item').length > prev
      },
      prevCount,
      { timeout: 5000 }
    )
  }

  async deleteSlide(index = 0) {
    const prevCount = await this.getSlideCount()
    // Hover slide then click delete button inside it
    const slideItem = this.thumbnailsLocator.nth(index)
    await slideItem.hover()
    await slideItem.locator('button[title="Delete"]').click()
    await this.page.waitForFunction(
      (prev) => {
        return document.querySelectorAll('.slide-panel .slide-item').length < prev
      },
      prevCount,
      { timeout: 5000 }
    )
  }

  async selectSlide(index) {
    await this.thumbnailsLocator.nth(index).click()
    await this.page.waitForTimeout(300)
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
    await this.page.waitForTimeout(300)
  }

  async replaceText(searchText, replaceText) {
    await this.findText(searchText)
    // Toggle replace panel
    await this.page.locator('.find-btn[title="Toggle replace"]').click()
    const replaceInput = this.page.locator('.find-input').nth(1)
    await replaceInput.fill(replaceText)
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
    await this.page
      .locator('.table-size-picker .table-cell')
      .nth((rows - 1) * 8 + (cols - 1))
      .click()
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
    await this.page.waitForTimeout(300)
  }

  async deleteSelectedElement() {
    await this.page.keyboard.press('Delete')
    await this.page.waitForTimeout(500)
  }

  async undo() {
    await this.page.keyboard.press('Control+z')
    await this.page.waitForTimeout(500)
  }

  async redo() {
    await this.page.keyboard.press('Control+y')
    await this.page.waitForTimeout(500)
  }

  async duplicateElement() {
    await this.page.keyboard.press('Control+d')
    await this.page.waitForTimeout(500)
  }

  async copyElement() {
    await this.page.keyboard.press('Control+c')
    await this.page.waitForTimeout(200)
  }

  async pasteElement() {
    await this.page.keyboard.press('Control+v')
    await this.page.waitForTimeout(500)
  }

  async deselectAll() {
    await this.page.keyboard.press('Escape')
    await this.page.waitForTimeout(200)
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
