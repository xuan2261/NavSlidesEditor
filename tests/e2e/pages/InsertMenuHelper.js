export class InsertMenuHelper {
  constructor({ page, getElementCount, setLastInsertedElementIndex }) {
    this.page = page
    this.getElementCount = getElementCount
    this.setLastInsertedElementIndex = setLastInsertedElementIndex
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

    await this.page.locator(`button.insert-item:has(span:text-is("${itemName}"))`).click()
  }

  async addTextNode() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Text')
    await this.page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )

    const nextIndex = (await this.getElementCount()) - 1
    this.setLastInsertedElementIndex(nextIndex)
    return nextIndex
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
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
  }

  async openMediaLibrary() {
    await this.clickInsertMenuItem('Media Library')
    await this.page.waitForSelector('h2:has-text("Media Library")')
  }

  async addCodeBlock() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Code Block')
    await this.page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
  }

  async addLatexBlock() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('LaTeX / TikZ')
    await this.page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
  }

  async addMarkdownBlock() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Markdown')
    await this.page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
  }

  async addChart() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Chart')
    await this.page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
  }

  async addCallout() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Callout')
    await this.page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
  }

  async addHtmlEmbed() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Embed HTML')
    await this.page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
  }

  async addDrawing() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Drawing Canvas')
    await this.page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
  }

  async addLine() {
    const prevCount = await this.getElementCount()
    await this.clickInsertMenuItem('Line / Arrow')
    await this.page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
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
      .locator('.table-size-picker button')
      .filter({ hasText: `${rows}×${cols}` })
      .first()
      .click()
    await this.page.locator('.table-size-picker button').filter({ hasText: /Insert.*Table/ }).click()

    await this.page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
  }
}
