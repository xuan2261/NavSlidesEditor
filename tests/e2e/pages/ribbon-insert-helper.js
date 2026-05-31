export class RibbonInsertHelper {
  constructor({ page, getElementCount, setLastInsertedElementIndex }) {
    this.page = page
    this.getElementCount = getElementCount
    this.setLastInsertedElementIndex = setLastInsertedElementIndex
  }

  // Items that remain inside dropdown menus
  static GROUPED_ITEMS = {}

  static GAME_LABELS = {
    'Name Picker': 'Name Picker',
    'Hot Potato Quiz': 'Hot Potato',
    'Hot Potato': 'Hot Potato',
    Jeopardy: 'Jeopardy',
    'Four Corners': 'Four Corners',
    'Relay Race': 'Relay Race',
    'Trivia Championship': 'Trivia',
    Trivia: 'Trivia',
    Scattergories: 'Scattergories',
  }

  // Menu item labels inside remaining dropdowns
  static MENU_ITEM_LABELS = {
    'More advanced insert options': 'Games...',
  }

  async clickInsertMenuItem(itemName) {
    await this.page.getByRole('tab', { name: 'Insert' }).click()
    const insertPanel = this.page.getByRole('tabpanel', { name: 'Insert' })
    await insertPanel.waitFor({ state: 'visible' })

    const aliases = {
      Text: 'Add text',
      'Code Block': 'Add code block',
      'LaTeX / TikZ': 'Add LaTeX',
      Markdown: 'Add markdown',
      Chart: 'Add chart',
      Callout: 'Add callout',
      'Embed HTML': 'Add HTML embed',
      Video: 'Add video',
      Audio: 'Audio / Upload',
      'Drawing Canvas': 'Add drawing',
      SVG: 'Add SVG',
      'Line / Arrow': 'Add line',
      'Media Library': 'Open media library',
      'File Browser': 'Open file browser',
      'QR Code': 'Add QR code',
      Icon: 'Add icon',
      Timeline: 'Add timeline',
      'Kinetic Text': 'Add kinetic text',
      'Math Grid': 'Add math grid',
      'Anime.js': 'Add Anime.js',
      'Three.js': 'Add Three.js',
      Trivia: 'Trivia',
      'Trivia Championship': 'Trivia',
      'Hot Potato Quiz': 'Hot Potato',
    }
    const label = aliases[itemName] || itemName

    const gameLabel = RibbonInsertHelper.GAME_LABELS[label]
    if (gameLabel) {
      await insertPanel.getByRole('button', { name: 'More advanced insert options' }).click()
      await this.page.getByRole('menuitem', { name: 'Games...' }).click()
      await this.page.getByRole('button', { name: gameLabel, exact: true }).click()
      return
    }

    // Check if item is in a dropdown group
    const groupName = RibbonInsertHelper.GROUPED_ITEMS[label]
    if (groupName) {
      // Open the dropdown first
      const groupTrigger = insertPanel.getByRole('button', { name: groupName })
      await groupTrigger.click()

      // Click the menu item
      const menuLabel = RibbonInsertHelper.MENU_ITEM_LABELS[label] || label
      const menuItem = this.page.getByRole('menuitem', { name: menuLabel })
      await menuItem.waitFor({ state: 'visible', timeout: 5000 })
      await menuItem.click()
    } else {
      const button = insertPanel.getByRole('button', { name: label, exact: true })
      await button.click()
    }
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
    await this.page.getByRole('tab', { name: 'Insert' }).click()
    const insertPanel = this.page.getByRole('tabpanel', { name: 'Insert' })
    await insertPanel.waitFor({ state: 'visible' })
    await insertPanel.getByRole('button', { name: 'Insert shape' }).click()
    const shapeGallery = this.page.locator('[data-ribbon-popup="shape-gallery"]').filter({ visible: true })
    await shapeGallery.waitFor({ state: 'visible', timeout: 5000 })
    await shapeGallery
      .getByRole('button', { name: shapeTitle, exact: true })
      .filter({ visible: true })
      .click()

    await this.page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )

    const nextIndex = (await this.getElementCount()) - 1
    this.setLastInsertedElementIndex(nextIndex)
    return nextIndex
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
    await this.page.getByRole('tab', { name: 'Insert' }).click()
    const insertPanel = this.page.getByRole('tabpanel', { name: 'Insert' })
    await insertPanel.waitFor({ state: 'visible' })
    await insertPanel.getByRole('button', { name: 'Add table' }).click()
    const tablePicker = this.page.locator('[data-ribbon-popup="table-picker"]').filter({ visible: true })
    await tablePicker.waitFor({ state: 'visible', timeout: 5000 })
    const tableCell = tablePicker
      .getByRole('button', {
        name: `Insert ${rows} by ${cols} table`,
        exact: true,
      })
      .filter({ visible: true })
    await tableCell.click()

    await this.page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
  }
}
