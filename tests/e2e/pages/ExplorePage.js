export class ExplorePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.backBtn = page.locator('button.btn-secondary').first();
    this.presentationCards = page.locator('.home-content > div > div > div');
  }

  async goto() {
    await this.page.goto('/explore', { timeout: 30000 });
    await this.page.waitForSelector('h1:has-text("Explore")', { timeout: 30000 });
  }

  async goBack() {
    await this.backBtn.click();
    await this.page.waitForURL('/', { timeout: 10000 });
  }

  async getCardCount() {
    // Wait a moment for data to load
    await this.page.waitForTimeout(1000);
    return this.presentationCards.count();
  }

  async isEmptyState() {
    return this.page.locator('text=No public presentations yet').isVisible();
  }

  async clickFork(index = 0) {
    await this.presentationCards.nth(index).locator('button:has-text("Fork")').click();
  }

  async clickView(index = 0) {
    await this.presentationCards.nth(index).locator('a:has-text("View")').click();
  }
}
