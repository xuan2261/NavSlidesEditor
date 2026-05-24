import { expect } from '@playwright/test'
import { EditorPage } from './editor-page.js'

export class GamePage {
  constructor(page) {
    this.page = page
    this.editor = new EditorPage(page)
    this.activeIndicator = page.getByTestId('game-active-indicator')
    this.hud = page.getByTestId('game-hud')
    this.leaderboard = page.getByTestId('game-leaderboard')
  }

  async gotoPresentation(presentationId) {
    await this.editor.gotoPresentation(presentationId)
  }

  async insertNamePicker() {
    await this.editor.clickInsertMenuItem('Name Picker')
    await expect(this.activeIndicator).toBeVisible()
  }
}
