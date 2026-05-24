import { expect } from '@playwright/test'

export class RibbonTabToolbarHelper {
  constructor({ page }) {
    this.page = page
  }

  async switchRibbonTab(tabName) {
    const tab = this.page.getByRole('tab', { name: tabName })
    await tab.click()
    await expect(tab).toHaveAttribute('aria-selected', 'true')
  }

  async clickMainToolbarButton(title) {
    await this.page.getByRole('tab', { name: 'Home' }).click()
    await this.page.locator(`.tour-step-ribbon button[title="${title}"]`).click()
  }

  async chooseMainToolbarOption(title, value) {
    await this.page.getByRole('tab', { name: 'Home' }).click()
    const select = this.page.locator(`.tour-step-ribbon select[title="${title}"]`)
    await select.click({ force: true })
    await select.selectOption(value)
  }

  async clickQuickAccessSave() {
    await this.page.locator('button[title*="Save"]').first().click()
  }

  async getToolbarOverflowMetrics() {
    return this.page.evaluate(() => {
      const toolbar = document.querySelector('.tour-step-ribbon')
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

  async getRibbonLayoutMetrics(tabName) {
    if (tabName) {
      await this.switchRibbonTab(tabName)
    }
    return this.page.evaluate((tab) => {
      const panel = document.querySelector('.tour-step-ribbon')
      if (!panel) return null
      const activePanel =
        document.querySelector('[role="tabpanel"][data-state="active"]') ||
        Array.from(document.querySelectorAll('[role="tabpanel"]')).find((node) => {
          const style = window.getComputedStyle(node)
          return style.display !== 'none' && style.visibility !== 'hidden'
        })
      const rows = activePanel
        ? Array.from(activePanel.querySelectorAll('[data-ribbon-content-row]'))
        : []
      const row = rows[0] || activePanel || panel

      const rowRect = row.getBoundingClientRect()
      const buttons = row.querySelectorAll('button')
      const clippedControls = []
      const outsideControls = []
      const getVisibleText = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement
          if (!parent) return ''
          const style = window.getComputedStyle(parent)
          if (style.display === 'none' || style.visibility === 'hidden') return ''
          return node.textContent || ''
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return ''
        const style = window.getComputedStyle(node)
        if (style.display === 'none' || style.visibility === 'hidden') return ''
        return Array.from(node.childNodes).map(getVisibleText).join('')
      }

      buttons.forEach((btn) => {
        const rect = btn.getBoundingClientRect()
        const label =
          btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.textContent?.trim() || 'unknown'
        const visibleText = getVisibleText(btn).trim()

        if (visibleText && btn.scrollWidth > btn.clientWidth + 1) {
          clippedControls.push({
            label,
            visibleText,
            clientWidth: btn.clientWidth,
            scrollWidth: btn.scrollWidth,
          })
        }

        if (rect.right > rowRect.right + 1 || rect.left < rowRect.left - 1) {
          outsideControls.push({
            label,
            rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
          })
        }
      })

      const overlaps = []
      const allControls = Array.from(buttons)
      for (let i = 0; i < allControls.length; i++) {
        for (let j = i + 1; j < allControls.length; j++) {
          const a = allControls[i].getBoundingClientRect()
          const b = allControls[j].getBoundingClientRect()
          const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
          const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
          const area = overlapX * overlapY
          if (area > 4) {
            overlaps.push({
              a: allControls[i].getAttribute('aria-label') || allControls[i].textContent?.trim(),
              b: allControls[j].getAttribute('aria-label') || allControls[j].textContent?.trim(),
              area,
            })
          }
        }
      }

      const sectionContainers = row.querySelectorAll('[data-ribbon-section]')
      const visibleSections = Array.from(sectionContainers)
        .map((s) => {
          const labelEl = s.querySelector('[data-ribbon-section-label]')
          const label = labelEl?.textContent?.trim()
          if (!label) return null
          const rect = s.getBoundingClientRect()
          return {
            label,
            visible: rect.right <= rowRect.right + 1 && rect.left >= rowRect.left - 1,
            rect: { left: rect.left, right: rect.right },
          }
        })
        .filter(Boolean)
      const firstSection = sectionContainers[0]?.getBoundingClientRect()

      return {
        tab,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        panel: {
          clientWidth: panel.clientWidth,
          scrollWidth: panel.scrollWidth,
          clientHeight: panel.clientHeight,
          scrollHeight: panel.scrollHeight,
          hasHorizontalOverflow: panel.scrollWidth > panel.clientWidth + 1,
        },
        row: {
          contentRowCount: rows.length,
          nestedContentRowCount: rows.filter((candidate) =>
            candidate.querySelector('[data-ribbon-content-row]')
          ).length,
          clientWidth: row.clientWidth,
          scrollWidth: row.scrollWidth,
          clientHeight: row.clientHeight,
          scrollHeight: row.scrollHeight,
          hasHorizontalOverflow: row.scrollWidth > row.clientWidth + 1,
          firstSectionLeftDelta: firstSection ? Math.round(firstSection.left - rowRect.left) : null,
        },
        clippedControls,
        outsideControls,
        overlaps,
        visibleSections,
        buttonCount: buttons.length,
      }
    }, tabName)
  }

  async getButtonClippingStatus(buttonLabels) {
    return this.page.evaluate((labels) => {
      const results = {}
      const getVisibleText = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement
          if (!parent) return ''
          const style = window.getComputedStyle(parent)
          if (style.display === 'none' || style.visibility === 'hidden') return ''
          return node.textContent || ''
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return ''
        const style = window.getComputedStyle(node)
        if (style.display === 'none' || style.visibility === 'hidden') return ''
        return Array.from(node.childNodes).map(getVisibleText).join('')
      }
      labels.forEach((label) => {
        const btn = document.querySelector(`button[aria-label="${label}"], button[title="${label}"]`)
        if (btn) {
          const visibleText = getVisibleText(btn).trim()
          results[label] = {
            found: true,
            visibleText,
            clientWidth: btn.clientWidth,
            scrollWidth: btn.scrollWidth,
            isClipped: !!visibleText && btn.scrollWidth > btn.clientWidth + 1,
          }
        } else {
          results[label] = { found: false }
        }
      })
      return results
    }, buttonLabels)
  }
}
