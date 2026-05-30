// Post-Phase-3 behavior: the AI Generator "Create" path builds slides LOCALLY
// from the outline via buildSlidesFromOutline (every field escaped) and makes
// NO /api/ai/generate-slides network call. This file previously locked the
// pre-Phase-3 raw-fetch behavior; the change here is the deliberate, visible
// result of removing the useless round-trip.
import { render, fireEvent, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LiveSocketContext } from '../../contexts/live-socket-context-provider.jsx'
import { useEditorStore } from '../../stores/editor-store'

function makeSeed() {
  return {
    id: 'char-deck',
    title: 'Char Deck',
    theme: 'black',
    slides: [{ id: 's1', background: '#101010', elements: [] }],
  }
}

const h = vi.hoisted(() => ({
  updatePresentation: vi.fn(() => Promise.resolve({})),
  seed: null,
}))

const sampleOutline = [
  { title: 'Intro', layout: 'title', bulletPoints: ['a', 'b'], notes: 'hello' },
  { title: 'Body', layout: 'content', bulletPoints: ['<script>x</script>'] },
]

vi.mock('../../utils/ai', () => ({
  aiGenerateOutline: vi.fn(() => Promise.resolve({ outline: sampleOutline })),
  aiRewrite: vi.fn(),
  aiTranslate: vi.fn(),
  testAIConnection: vi.fn(),
}))

vi.mock('../../utils/api', () => ({
  api: {
    getPresentation: vi.fn(() => Promise.resolve(JSON.parse(JSON.stringify(h.seed)))),
    getTemplate: vi.fn(() => Promise.resolve(JSON.parse(JSON.stringify(h.seed)))),
    updatePresentation: h.updatePresentation,
    updateTemplate: vi.fn(() => Promise.resolve({})),
    getShareStatus: vi.fn(() => Promise.resolve({ shared: false, token: null })),
    uploadFile: vi.fn(() => Promise.resolve({ url: '/x.png' })),
  },
}))

import EditorPage from '../EditorPage.jsx'

function renderPage() {
  return render(
    <LiveSocketContext.Provider value={null}>
      <EditorPage presentationId="char-deck" onGoHome={() => {}} />
    </LiveSocketContext.Provider>
  )
}

function lastSaved() {
  const calls = h.updatePresentation.mock.calls
  return calls.length ? calls[calls.length - 1][1] : null
}

async function openGeneratorAndCreate() {
  const aiBtn = await screen.findByRole('button', { name: /^AI$/i })
  await act(async () => {
    fireEvent.mouseDown(aiBtn)
  })
  const genItem = await screen.findByText('AI Slide Generator')
  await act(async () => {
    fireEvent.mouseDown(genItem)
  })
  const topic = await screen.findByPlaceholderText(/IoT Security/i)
  await act(async () => {
    fireEvent.change(topic, { target: { value: 'Test topic' } })
  })
  const genBtn = await screen.findByRole('button', { name: /^Generate/i })
  await act(async () => {
    fireEvent.click(genBtn)
  })
  const createBtn = await screen.findByRole('button', { name: /Create/i })
  await act(async () => {
    fireEvent.click(createBtn)
  })
}

beforeEach(() => {
  h.seed = makeSeed()
  h.updatePresentation.mockClear()
  useEditorStore.setState({ selectedElementIds: [], editingElementId: null, clipboard: null })
  // If anything tries to fetch, we can detect it.
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EditorPage AI-generate (post-Phase-3: local build, no fetch)', () => {
  it('builds slides locally and makes NO /api/ai/generate-slides call', async () => {
    renderPage()
    await screen.findByDisplayValue('Char Deck')
    await openGeneratorAndCreate()

    await waitFor(
      () => {
        const snap = lastSaved()
        expect(snap).toBeTruthy()
        // seed had 1 slide; outline has 2 -> 3 total, built locally.
        expect(snap.slides).toHaveLength(3)
      },
      { timeout: 2500 }
    )

    // The deliberate behavior change: no generate-slides round-trip.
    const calledGenerateSlides = globalThis.fetch.mock.calls.some(
      ([url]) => typeof url === 'string' && url.includes('/api/ai/generate-slides')
    )
    expect(calledGenerateSlides).toBe(false)
  })

  it('SECURITY: a script payload in the outline is escaped in the produced slide content', async () => {
    renderPage()
    await screen.findByDisplayValue('Char Deck')
    await openGeneratorAndCreate()

    await waitFor(
      () => {
        const snap = lastSaved()
        expect(snap).toBeTruthy()
        expect(snap.slides).toHaveLength(3)
      },
      { timeout: 2500 }
    )

    const snap = lastSaved()
    const bodySlide = snap.slides[2] // the 'Body' outline item
    const content = bodySlide.elements[0].content
    expect(content).not.toContain('<script>x</script>')
    expect(content).toContain('&lt;script&gt;')
  })
})
