import { vi } from 'vitest'
import { createDefaultGameConfig } from 'revealjs-shared'

export const deck = (title) => ({
  id: 'replay-ordering-deck',
  title,
  aggregateGeneration: 1,
  slides: [
    {
      id: 'slide-1',
      elements: [
        { id: 'poll-1', type: 'game', gameType: 'poll', poll: createDefaultGameConfig('poll') },
      ],
    },
  ],
})

export function receiptAuthority() {
  let generation = 1
  let presentation = null
  const receipts = new Map()
  return {
    get generation() {
      return generation
    },
    get presentation() {
      return presentation
    },
    save(body) {
      const identity = JSON.stringify(body)
      const receipt = receipts.get(body.idempotencyKey)
      if (receipt) {
        if (receipt.identity !== identity) throw new Error('IDEMPOTENCY_KEY_CONFLICT')
        return receipt.result
      }
      if (body.aggregateGeneration !== generation) throw new Error('STALE_GENERATION')
      presentation = structuredClone(body)
      const result = { ...presentation, aggregateGeneration: ++generation }
      receipts.set(body.idempotencyKey, { identity, result })
      return result
    },
  }
}

export function stubSynchronousReceipt(authority) {
  vi.stubGlobal(
    'XMLHttpRequest',
    class {
      open() {}
      setRequestHeader() {}
      send(body) {
        try {
          this.responseText = JSON.stringify(authority.save(JSON.parse(body)))
          this.status = 200
        } catch (error) {
          this.responseText = JSON.stringify({ error: error.message })
          this.status = 409
        }
      }
    }
  )
}

export function oversizedDeck(title) {
  const value = deck(title)
  value.slides[0].elements.push({
    id: 'context-note',
    type: 'text',
    content: `<p>${'x'.repeat(65536)}</p>`,
  })
  return value
}
