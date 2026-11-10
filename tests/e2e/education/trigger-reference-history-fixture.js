import { apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { deckWith } from './release-game-fixtures.js'
import { referenceDeck } from './trigger-reference-history-controls.js'
export { prepare, section, target, element }
async function prepare(page, request, id, deck = referenceDeck()) {
  await apiUpdatePresentation(request, id, { ...deckWith([]), ...deck })
  await new EditorPage(page).gotoPresentation(id)
}
const section = (popup, id) => popup.locator(`[data-ns-effective-slide-id="${id}"]`)
const target = (popup, slide, id) => section(popup, slide).locator(`[data-ns-element-id="${id}"]`)
const element = (deck, id) => deck.slides[0].elements.find((item) => item.id === id)
