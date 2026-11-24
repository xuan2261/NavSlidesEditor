import { describe, expect, it } from 'vitest'
import media from '../src/education/game-media-references.js'
import fixture from './fixtures/education-native-media.js'
import {
  buildArchiveMediaManifestEntries,
  collectProjectMediaEntries,
  rewriteProjectMediaUrls,
} from '../../client/src/utils/project-media-utils.js'
import importer from '../../server/services/project-import-presentation.js'

const { nativeMediaFixture, image, side, game } = fixture
const {
  collectGameMediaReferences,
  rewriteGameMediaUrls,
  collectNativeGameConfigMediaReferences,
  rewriteNativeGameConfigMediaUrls,
} = media
const readPath = (value, path) => path.reduce((at, key) => at[key], value)
const expectedNames = [
  'question',
  'option',
  'matching-question',
  'left',
  'right',
  'poll',
  'jeopardy',
  'patch',
  'target',
  'memory-first',
  'memory-second',
  'front',
  'back',
  'sorting',
  'prompt',
  'placeholder',
]

describe('editable native media roundtrip', () => {
  it('discovers nested-only native bytes, vertical children and authored master defaults', () => {
    const deck = nativeMediaFixture()
    const refs = collectGameMediaReferences(deck)
    expect(new Set(refs.map((ref) => ref.url))).toEqual(
      new Set(expectedNames.map((name) => image(name).src))
    )
    for (const ref of refs) expect(readPath(deck, ref.path)).toBe(ref.url)
    expect(
      collectProjectMediaEntries(deck, { localOnly: true })
        .map((ref) => ref.originalUrl)
        .sort()
    ).toEqual(expectedNames.map((name) => image(name).src).sort())
    expect(refs.find((ref) => ref.url === image('memory-second').src).path).toEqual([
      'slides',
      0,
      'children',
      0,
      'elements',
      0,
      'memory',
      'pairs',
      0,
      'second',
      'src',
    ])
  })

  it('restores every native reference to target uploads in both client and atomic server import', () => {
    const deck = nativeMediaFixture()
    const manifest = buildArchiveMediaManifestEntries(deck)
    const placements = manifest.map((entry, i) => ({ ...entry, filename: `target-${i}.png` }))
    const map = Object.fromEntries(
      placements.map((entry) => [entry.originalUrl, `/uploads/${entry.filename}`])
    )
    const client = rewriteProjectMediaUrls(deck, map)
    const server = importer.buildImportedPresentation({
      presentation: deck,
      placements,
      intendedPresentationId: 'target-deck',
      commitStartedAt: '2026-10-02T00:00:00.000Z',
      sessionId: 'import-session',
      payloadDigest: 'fixture',
    })
    for (const ref of collectGameMediaReferences(deck)) {
      expect(readPath(client, ref.path)).toBe(map[ref.url])
      expect(readPath(server, ref.path)).toBe(map[ref.url])
    }
    expect(
      collectGameMediaReferences(server).some((ref) => ref.url.startsWith('https://source.example'))
    ).toBe(false)
    expect(deck.slides[0].elements[0].quiz.questions[0].media.src).toBe(image('question').src)
  })

  it('deduplicates remote/local URLs without ambiguous duplicate filenames in the archive', () => {
    const repeated = image('same').src
    const urls = [
      repeated,
      '/uploads/same.png',
      'https://other.example/uploads/same.png',
      'https://cdn.example/same.png',
    ]
    const deck = {
      slides: [{ elements: urls.concat(repeated).map((src) => ({ type: 'image', src })) }],
    }
    expect(collectProjectMediaEntries(deck).map((entry) => entry.originalUrl)).toEqual(urls)
    const manifest = buildArchiveMediaManifestEntries(deck)
    expect(manifest.map((entry) => entry.originalUrl)).toEqual(urls.slice(0, 3))
    expect(new Set(manifest.map((entry) => entry.archivePath)).size).toBe(3)
    expect(
      rewriteGameMediaUrls(deck, { [repeated]: '/uploads/restored.png' }).slides[0].elements.map(
        (element) => element.src
      )
    ).toEqual(['/uploads/restored.png', ...urls.slice(1), '/uploads/restored.png'])
  })

  it('keeps archive manifest paths distinct even when URL hashes and basenames collide', () => {
    const urls = ['/uploads/Aa/photo.png', '/uploads/B@/photo.png']
    const deck = { slides: [{ elements: urls.map((src) => ({ type: 'image', src })) }] }
    const manifest = buildArchiveMediaManifestEntries(deck)
    expect(manifest.map((entry) => entry.originalUrl)).toEqual(urls)
    expect(manifest[0].archivePath).not.toBe(manifest[1].archivePath)
  })

  it('preserves retained subtype media, deep vertical media and canonical public question fields', () => {
    const deck = nativeMediaFixture()
    const quiz = deck.slides[0].elements[0]
    quiz.flashcards = {
      cards: [{ id: 'retained', front: side('retained'), back: { type: 'text', text: 'Answer' } }],
    }
    quiz.questions = structuredClone(quiz.quiz.questions)
    quiz.questions[0].media = image('flat')
    deck.slides[0].children[0].children = [
      { elements: [{ type: 'image', src: image('deep').src }] },
    ]
    const refs = collectGameMediaReferences(deck)
    expect(refs.find((ref) => ref.url === image('retained').src).path).toEqual([
      'slides',
      0,
      'elements',
      0,
      'flashcards',
      'cards',
      0,
      'front',
      'src',
    ])
    expect(refs.find((ref) => ref.url === image('flat').src).path).toEqual([
      'slides',
      0,
      'elements',
      0,
      'questions',
      0,
      'media',
      'src',
    ])
    expect(refs.find((ref) => ref.url === image('deep').src).path).toEqual([
      'slides',
      0,
      'children',
      0,
      'children',
      0,
      'elements',
      0,
      'src',
    ])
    const publicConfig = structuredClone(quiz.quiz)
    publicConfig.questions.forEach((question) => {
      delete question.answerKey
      delete question.feedback
    })
    const publicRefs = collectNativeGameConfigMediaReferences('quiz', publicConfig)
    expect(publicRefs.map((ref) => ref.url)).toEqual(
      ['question', 'option', 'matching-question', 'left', 'right'].map((name) => image(name).src)
    )
    expect(
      rewriteNativeGameConfigMediaUrls(
        'quiz',
        publicConfig,
        new Map([[image('left').src, '/uploads/new-left.png']])
      ).questions[1].options.left[0].media.src
    ).toBe('/uploads/new-left.png')
  })

  it('ignores unknown fields, wrong game types, text card sides and unsafe media', () => {
    const deck = {
      slides: [
        {
          elements: [
            game('flashcards', {
              cards: [
                {
                  id: 'card',
                  front: side('front'),
                  back: { type: 'text', text: image('text').src, src: image('not-image').src },
                  extra: side('unknown'),
                },
              ],
              unknown: { media: image('unknown-config') },
            }),
            {
              type: 'html',
              content: `<img src="${image('html').src}">`,
              quiz: { questions: [{ media: image('wrong-type') }] },
            },
            game('unknown-subtype', { media: image('unknown-type') }),
            game('sorting', {
              items: [
                { media: { src: 'javascript:alert(1)', alt: 'unsafe' } },
                { media: { src: '/uploads/no-alt.png' } },
              ],
            }),
          ],
        },
      ],
    }
    const refs = collectGameMediaReferences(deck)
    expect(refs.map((ref) => ref.url)).toEqual([image('front').src])
    const map = Object.fromEntries(
      [
        'front',
        'text',
        'not-image',
        'unknown',
        'unknown-config',
        'html',
        'wrong-type',
        'unknown-type',
      ].map((name) => [image(name).src, '/uploads/new.png'])
    )
    const rewritten = rewriteGameMediaUrls(deck, map)
    expect(rewritten.slides[0].elements[0].flashcards.cards[0].front.src).toBe('/uploads/new.png')
    expect(rewritten.slides[0].elements[0].flashcards.cards[0].back).toEqual(
      deck.slides[0].elements[0].flashcards.cards[0].back
    )
    expect(rewritten.slides[0].elements[1]).toEqual(deck.slides[0].elements[1])
    expect(() =>
      rewriteGameMediaUrls(deck, { [image('front').src]: 'javascript:alert(1)' })
    ).toThrow(/media|URL/i)
    expect(() =>
      rewriteGameMediaUrls(deck, { [image('front').src]: 'data:audio/wav;base64,YQ==' })
    ).toThrow(/media|URL/i)
  })

  it('maps standalone public native configs without touching answers, text or source configs', () => {
    const config = nativeMediaFixture().slides[0].elements[0].quiz
    const map = Object.fromEntries(
      collectNativeGameConfigMediaReferences('quiz', config).map((ref) => [
        ref.url,
        'data:image/png;base64,YQ==',
      ])
    )
    const restored = rewriteNativeGameConfigMediaUrls('quiz', config, map)
    expect(restored.questions[0].media.src).toBe('data:image/png;base64,YQ==')
    expect(restored.questions[1].options.left[0].media.src).toBe('data:image/png;base64,YQ==')
    expect(restored.questions[0].answerKey).toEqual(config.questions[0].answerKey)
    expect(restored.questions[0].prompt).toBe(config.questions[0].prompt)
    expect(config.questions[0].media.src).toBe(image('question').src)
  })

  it('preserves ordinary background/poster/caption behavior at every authored location', () => {
    const deck = {
      slides: [
        {
          background: { type: 'image', src: '/uploads/background.png' },
          elements: [
            {
              type: 'video',
              src: '/uploads/video.mp4',
              poster: '/uploads/poster.png',
              tracks: [{ src: '/uploads/captions.vtt' }],
            },
          ],
          children: [
            { background: { type: 'image', image: '/uploads/vertical.png' }, elements: [] },
          ],
        },
      ],
      layoutMasters: [
        { id: 'master', fixedElements: [{ type: 'image', src: '/uploads/master.png' }] },
      ],
    }
    const map = Object.fromEntries(
      collectGameMediaReferences(deck).map((ref) => [
        ref.url,
        ref.url.replace('/uploads/', '/uploads/target-'),
      ])
    )
    const result = rewriteProjectMediaUrls(deck, map)
    expect(result.slides[0].background).toEqual({
      type: 'image',
      image: '/uploads/target-background.png',
    })
    expect(result.slides[0].elements[0].tracks[0].src).toBe('/uploads/target-captions.vtt')
    expect(result.slides[0].children[0].background.image).toBe('/uploads/target-vertical.png')
    expect(result.layoutMasters[0].fixedElements[0].src).toBe('/uploads/target-master.png')
  })
})
