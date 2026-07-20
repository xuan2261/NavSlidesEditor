import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearEditorDraft,
  createEditorDraft,
  editorDraftKey,
  readEditorDraft,
  writeEditorDraft,
} from './editor-draft-store'

const snapshot = (title, id = 'deck-1') => ({
  id,
  title,
  aggregateGeneration: 4,
  idempotencyKey: `key-${title}`,
  slides: [{ id: 'slide-1', elements: [] }],
})

describe('editor draft storage', () => {
  beforeEach(async () => {
    localStorage.clear()
    await clearEditorDraft('deck-1')
    await clearEditorDraft('deck-2')
  })

  it('stores an oversized pending snapshot durably in browser storage', async () => {
    const pending = createEditorDraft({
      snapshot: { ...snapshot('pending'), blob: 'x'.repeat(70 * 1024) },
      isTemplate: false,
      attemptId: 9,
    })

    expect(pending.key).toBe(editorDraftKey('deck-1'))
    expect(await writeEditorDraft(pending)).toBe(true)
    await expect(readEditorDraft('deck-1')).resolves.toMatchObject({
      id: 'deck-1',
      attemptId: 9,
      snapshot: { title: 'pending' },
    })
  })

  it('does not delete a newer draft when an older save completes', async () => {
    const first = createEditorDraft({ snapshot: snapshot('first'), attemptId: 1 })
    const second = createEditorDraft({ snapshot: snapshot('second'), attemptId: 2 })
    await writeEditorDraft(first)
    await writeEditorDraft(second)

    await clearEditorDraft('deck-1', false, first.idempotencyKey)

    await expect(readEditorDraft('deck-1')).resolves.toMatchObject({
      attemptId: 2,
      snapshot: { title: 'second' },
    })
  })

  it('clears the matching draft after a committed save', async () => {
    const pending = createEditorDraft({ snapshot: snapshot('pending'), attemptId: 3 })
    await writeEditorDraft(pending)

    await clearEditorDraft('deck-1', false, pending.idempotencyKey)

    await expect(readEditorDraft('deck-1')).resolves.toBeNull()
  })
})
