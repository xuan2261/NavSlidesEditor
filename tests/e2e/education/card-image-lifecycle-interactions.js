import { expect } from '@playwright/test'
import { gameFixture, deckWith } from './release-game-fixtures.js'

export const picture = (alt, width, height, color) => ({
  type: 'image',
  alt,
  src: `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${color}"/></svg>`).toString('base64')}`,
})
const text = (value) => ({ type: 'text', text: value })
export const images = [
  picture('Amber memory illustration', 36, 24, '#d97706'),
  picture('Teal memory illustration', 28, 32, '#0d9488'),
]
export const rootFor = (page, slide, id) =>
  page.locator(`[data-ns-effective-slide-id="${slide}"] [data-ns-game][data-ns-element-id="${id}"]`)
export const cards = (root) => root.locator('[data-ns-memory-card]')
export const command = (root, name) => root.getByRole('button', { name, exact: true }).click()
export const progress = (root, pairs, attempts, score) =>
  expect(root.locator('[data-ns-memory-progress]')).toHaveText(
    `${pairs} / 2 pairs matched · ${attempts} attempts · ${score} points`
  )

export function cardDeck() {
  const memory = (id, x, y) => ({
    ...gameFixture('memory'),
    id,
    x,
    y,
    width: 450,
    height: 250,
    memory: {
      title: id,
      shuffleOnStart: false,
      mismatchDelayMs: 800,
      matchPoints: 10,
      pairs: [
        { id: 'amber', first: images[0], second: text('Amber partner') },
        { id: 'teal', first: images[1], second: text('Teal partner') },
      ],
    },
  })
  const flash = {
    ...gameFixture('flashcards'),
    id: 'mixed-flash',
    x: 15,
    y: 280,
    width: 450,
    height: 245,
    flashcards: {
      title: 'Mixed face flashcards',
      shuffleOnStart: false,
      cards: [
        { id: 'front-image', front: images[0], back: text('Amber hidden answer') },
        { id: 'back-image', front: text('Teal visible question'), back: images[1] },
      ],
    },
  }
  return {
    ...deckWith([]),
    layoutMasters: [
      {
        id: 'cards',
        name: 'Cards',
        placeholders: [],
        fixedElements: [memory('inherited-memory', 495, 280)],
      },
    ],
    slides: [
      {
        id: 'parent',
        layoutId: 'cards',
        elements: [memory('memory-a', 15, 15), memory('memory-b', 495, 15), flash],
        children: [{ id: 'child', layoutId: 'cards', elements: [memory('child-witness', 15, 15)] }],
      },
    ],
  }
}

export async function decodedImage(root, content, width, height) {
  const image = root.getByRole('img', { name: content.alt, exact: true })
  await expect(image).toBeVisible()
  const observed = await image.evaluate(async (node) => {
    await node.decode()
    return {
      alt: node.alt,
      src: node.getAttribute('src'),
      width: node.naturalWidth,
      height: node.naturalHeight,
    }
  })
  expect(observed).toEqual({ alt: content.alt, src: content.src, width, height })
  return observed
}

export async function concealed(root) {
  await expect(root.getByRole('img')).toHaveCount(0)
  for (let index = 0; index < 4; index++) {
    await expect(cards(root).nth(index)).toHaveAccessibleName(`Card ${index + 1}, face down`)
    await expect(cards(root).nth(index)).toHaveAttribute('data-ns-card-state', 'face-down')
  }
  const accessibility = await root.ariaSnapshot()
  for (const secret of [...images.map((image) => image.alt), 'Amber partner', 'Teal partner'])
    expect(accessibility).not.toContain(secret)
  await expect(root.getByText('Amber partner', { exact: true })).not.toBeVisible()
  await expect(root.getByText('Teal partner', { exact: true })).not.toBeVisible()
  return accessibility
}

// Observe native inputs and actual DOM transitions only; never drive runtime state or time.
export async function observeCardDOM(page) {
  await page.evaluate(() => {
    window.__cardImageObservations = []
    for (const root of document.querySelectorAll('[data-ns-game]')) {
      const identity = {
        slide: root.closest('[data-ns-effective-slide-id]').dataset.nsEffectiveSlideId,
        element: root.dataset.nsElementId,
      }
      const record = (extra) =>
        window.__cardImageObservations.push({
          ...identity,
          at: performance.now(),
          paused: root.classList.contains('ns-education-paused'),
          states: [...root.querySelectorAll('[data-ns-memory-card]')].map(
            (card) => card.dataset.nsCardState
          ),
          progress: root.querySelector('output')?.textContent,
          status: root.querySelector('[role="status"]')?.textContent,
          ...extra,
        })
      root.addEventListener(
        'click',
        (event) =>
          record({
            kind: 'input',
            trusted: event.isTrusted,
            card: event.target.closest('[data-ns-memory-card]')?.dataset.nsMemoryCard,
            command: event.target.closest('button')?.dataset.nsCommand,
          }),
        true
      )
      new MutationObserver(() => record({ kind: 'render' })).observe(root, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      })
      record({ kind: 'initial' })
    }
  })
}

export async function beginMismatch(root, checkThird = false) {
  await cards(root).nth(0).click()
  await cards(root).nth(2).click()
  await expect(cards(root).nth(0)).toHaveAttribute('data-ns-card-state', 'face-up')
  await expect(cards(root).nth(2)).toHaveAttribute('data-ns-card-state', 'face-up')
  await expect(cards(root).nth(1)).toBeDisabled()
  await progress(root, 0, 1, 0)
  if (checkThird) {
    const third = cards(root).nth(1),
      before = await third.getAttribute('aria-label')
    const box = await third.boundingBox()
    expect(box).not.toBeNull()
    await root.page().mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(third).toHaveAttribute('aria-label', before)
    await expect(third).toHaveAttribute('data-ns-card-state', 'face-down')
    await progress(root, 0, 1, 0)
  }
}

export async function settledMismatch(root) {
  await expect(cards(root).nth(0)).toHaveAttribute('data-ns-card-state', 'face-down')
  await expect(cards(root).nth(2)).toHaveAttribute('data-ns-card-state', 'face-down')
  await expect(cards(root).nth(1)).toBeEnabled()
  await progress(root, 0, 1, 0)
}

export async function finishMemory(root) {
  await cards(root).nth(0).press('Enter')
  await cards(root).nth(0).press('Space')
  await progress(root, 0, 0, 0)
  await cards(root).nth(1).press('Space')
  await progress(root, 1, 1, 10)
  await expect(cards(root).nth(0)).toBeDisabled()
  const box = await cards(root).nth(0).boundingBox()
  expect(box).not.toBeNull()
  await root.page().mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await progress(root, 1, 1, 10)
  await cards(root).nth(2).click()
  await cards(root).nth(3).click()
  await progress(root, 2, 2, 20)
  await expect(root.locator('[data-ns-card-state="matched"]')).toHaveCount(4)
  for (let index = 0; index < 4; index++) await expect(cards(root).nth(index)).toBeDisabled()
  return {
    progress: await root.locator('output').textContent(),
    accessibility: await root.ariaSnapshot(),
    feedback: await root.locator('[data-ns-game-ui] > [role="status"]').innerText(),
  }
}

export async function exerciseFlashcards(root) {
  const output = root.locator('[data-ns-flashcards-progress]')
  const face = (side) => root.getByRole('group', { name: `Card ${side}`, exact: true })
  const flip = () => root.locator('[data-ns-command="flip"]').click()
  await expect(output).toHaveText('Card 1 / 2 · 0 / 2 studied')
  await expect(root.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled()
  await expect(face('back')).toHaveCount(0)
  expect(await root.ariaSnapshot()).not.toContain('Amber hidden answer')
  const frontImage = await decodedImage(root, images[0], 36, 24)
  await flip()
  await expect(face('back')).toHaveText('Amber hidden answer')
  await expect(face('front')).toHaveCount(0)
  expect(await root.ariaSnapshot()).not.toContain(images[0].alt)
  await expect(output).toHaveText('Card 1 / 2 · 1 / 2 studied')
  await flip()
  await flip()
  await expect(output).toHaveText('Card 1 / 2 · 1 / 2 studied')
  await command(root, 'Next')
  await expect(face('front')).toHaveText('Teal visible question')
  await expect(root.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await expect(root.getByRole('img')).toHaveCount(0)
  expect(await root.ariaSnapshot()).not.toContain(images[1].alt)
  await flip()
  const backImage = await decodedImage(root, images[1], 28, 32)
  await expect(output).toHaveText('Card 2 / 2 · 2 / 2 studied')
  await command(root, 'Previous')
  await expect(face('front')).toBeVisible()
  await decodedImage(root, images[0], 36, 24)
  await expect(output).toHaveText('Card 1 / 2 · 2 / 2 studied')
  await command(root, 'Reset')
  await flip()
  await flip()
  await expect(output).toHaveText('Card 1 / 2 · 1 / 2 studied')
  await command(root, 'Shuffle')
  await decodedImage(root, images[0], 36, 24)
  await expect(output).toHaveText(/Card [12] \/ 2 · 1 \/ 2 studied/)
  const position = (await output.textContent()).startsWith('Card 1') ? 1 : 2
  await expect(
    root.getByRole('button', { name: position === 1 ? 'Previous' : 'Next', exact: true })
  ).toBeDisabled()
  await flip()
  await flip()
  await expect(output).toContainText('1 / 2 studied')
  await command(root, position === 1 ? 'Next' : 'Previous')
  await expect(face('front')).toHaveText('Teal visible question')
  await flip()
  await decodedImage(root, images[1], 28, 32)
  await expect(output).toContainText('2 / 2 studied')
  await command(root, position === 1 ? 'Previous' : 'Next')
  await decodedImage(root, images[0], 36, 24)
  await flip()
  await expect(face('back')).toHaveText('Amber hidden answer')
  await expect(output).toContainText('2 / 2 studied')
  const completed = {
    progress: await output.textContent(),
    accessibility: await root.ariaSnapshot(),
  }
  await command(root, 'Reset')
  await expect(output).toHaveText('Card 1 / 2 · 0 / 2 studied')
  await expect(face('back')).toHaveCount(0)
  await expect(root.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled()
  await expect(root.locator('[data-ns-command="flip"]')).toHaveAccessibleName('Show back of card 1')
  await decodedImage(root, images[0], 36, 24)
  return { frontImage, backImage, completed, reset: await output.textContent() }
}
