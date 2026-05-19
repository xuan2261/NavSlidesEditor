import { expect } from '@playwright/test'

export class TextEditorProseMirrorHelper {
  constructor({ page, elementsCountLocator, getElementCount, getLastInsertedElementIndex }) {
    this.page = page
    this.elementsCountLocator = elementsCountLocator
    this.getElementCount = getElementCount
    this.getLastInsertedElementIndex = getLastInsertedElementIndex
  }

  async startEditingTextElement(index) {
    const fallback = this.getLastInsertedElementIndex() ?? -1
    const target = index ?? fallback
    const count = await this.getElementCount()
    const resolvedIndex = target < 0 ? count + target : target
    if (resolvedIndex < 0 || resolvedIndex >= count) {
      throw new Error(`No element wrapper at index ${target}`)
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

  async getTextEditorState() {
    return this.page.evaluate(() => ({
      proseMirrorCount: document.querySelectorAll('.ProseMirror').length,
      proseMirrorFocused: !!document.querySelector('.ProseMirror-focused'),
      toolbarHintVisible:
        document.querySelector('.tour-step-ribbon')?.textContent?.includes(
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
}
