import { expect } from '@playwright/test'
import { activate, home } from './pptx-semantic-ui-journey.js'

export async function reopenFromHome(page, deck, interaction) {
  await home(page)
  const response = page.waitForResponse(candidate => candidate.request().method() === 'GET' &&
    new URL(candidate.url()).pathname === `/api/presentations/${deck.id}`, { timeout: 60000 })
  const [opened] = await Promise.all([
    response,
    activate(page.getByRole('button', { name: `Open ${deck.title || 'Untitled'}`, exact: true }), interaction),
  ])
  expect(opened.ok(), `Dashboard reopen HTTP ${opened.status()}`).toBe(true)
  await expect(page).toHaveURL(url => url.pathname === `/editor/${deck.id}`)
  await expect(page.getByTestId('canvas-area')).toBeVisible({ timeout: 60000 })
}

export async function exportProject(page, interaction) {
  const trigger = page.getByTestId('ribbon-file-menu-trigger')
  if (await trigger.getAttribute('aria-expanded') !== 'true') await activate(trigger, interaction)
  const menu = page.getByRole('menuitem', { name: 'Export Project', exact: true })
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    activate(menu, interaction),
  ])
  expect(download.suggestedFilename()).toMatch(/\.navslides(\.json)?$/)
  return download
}
