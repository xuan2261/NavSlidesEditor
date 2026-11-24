// @vitest-environment node
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { collectSemanticFontRequests } = require('../../shared/src/pptx-source-font-request')
const { canonicalEditableSnapshot, assertSnapshotBudget } = require('../../server/services/pptx-import/canonical-snapshot')
const {
  rebindPictureReplacementOwnership,
} = require('../../server/services/pptx-import/picture-replacement-validation')
const {
  semanticInstance,
} = require('../../shared/src/pptx-semantic-records')

describe('output, font request, snapshot, and picture replacement migration to canonical accessors', () => {
  it('collects run-local font requests with occurrence provenance', () => {
    const semantic = {
      schemaVersion: 1,
      definitions: {
        d1: {
          id: 'd1',
          kind: 'text',
          source: { partUri: 'ppt/slides/slide1.xml', nativeId: '1', preconditionHash: 'a'.repeat(64) },
          components: [
            { id: 'body', kind: 'property', locator: { path: [0, 0], preconditionHash: 'a'.repeat(64) } },
            { id: 'p', kind: 'paragraph', locator: { path: [0, 0, 0], preconditionHash: 'a'.repeat(64) } },
            { id: 'r', kind: 'run', locator: { path: [0, 0, 0, 0], preconditionHash: 'a'.repeat(64) } },
          ],
          content: {
            textDocument: {
              schemaVersion: 1,
              componentId: 'body',
              paragraphs: [{
                componentId: 'p',
                properties: {},
                runs: [{
                  componentId: 'r',
                  kind: 'text',
                  text: 'Testing font extraction',
                  properties: { fontLatin: { typeface: 'Consolas' } },
                }],
              }],
            },
          },
        },
      },
      instances: {
        i1: {
          id: 'i1',
          definitionId: 'd1',
          slideId: 's1',
          parentInstanceId: null,
          localTransform: [1, 0, 0, 1, 0, 0],
          paintIndex: 0,
          overrides: {},
        },
      },
      styles: {},
      fonts: {},
    }

    const result = collectSemanticFontRequests(semantic)
    expect(result.faces).toHaveLength(1)
    expect(result.faces[0]).toMatchObject({ typeface: 'Consolas' })
    expect(result.locations['source-0']).toHaveLength(1)
    expect(result.locations['source-0'][0]).toMatchObject({
      instanceId: 'i1', componentId: 'r', path: 'paragraphs[0].runs[0]',
    })
    const parsed = JSON.parse(result.identity)
    expect(parsed.provenance).toHaveLength(1)
    expect(parsed.provenance[0]).toMatchObject({ instanceId: 'i1', definitionId: 'd1' })
  })

  it('canonicalEditableSnapshot uses semanticInstance and semanticDefinition rather than raw dictionary lookups', () => {
    const presentation = {
      id: 'deck',
      slides: [{
        id: 's1',
        elements: [{
          id: 'e1',
          type: 'text',
          pptxInstanceId: 'i1',
        }],
      }],
      pptxSemantic: {
        schemaVersion: 1,
        definitions: {
          d1: {
            id: 'd1',
            kind: 'text',
            source: { partUri: 'ppt/slides/slide1.xml', nativeId: '1', preconditionHash: 'a'.repeat(64) },
            components: [],
            content: {},
          },
        },
        instances: {
          i1: {
            id: 'i1',
            definitionId: 'd1',
            slideId: 's1',
            parentInstanceId: null,
            localTransform: [1, 0, 0, 1, 0, 0],
            paintIndex: 0,
            overrides: {},
          },
        },
        styles: {},
        fonts: {},
      },
    }

    const snapshot = canonicalEditableSnapshot(presentation)
    expect(snapshot.slides[0].elements[0].pptxInstanceId).toBe('i1')
    expect(assertSnapshotBudget(presentation)).toBeGreaterThan(0)
  })

  it('rebindPictureReplacementOwnership updates instance overrides using replaceSemanticRecords', async () => {
    const storage = require('../../server/services/storage')
    const replacement = {
      kind: 'uploaded-picture',
      presentationId: 'source-pres',
      filename: 'sample.png',
      sha256: 'e'.repeat(64),
      width: 100,
      height: 100,
    }
    const presentation = {
      id: 'dest-pres',
      slides: [{
        id: 's1',
        elements: [{
          id: 'el-pic',
          type: 'image',
          pptxInstanceId: 'pic-inst',
        }],
      }],
      pptxSemantic: {
        schemaVersion: 1,
        definitions: {
          picDef: {
            id: 'picDef',
            kind: 'picture',
            source: { partUri: 'ppt/slides/slide1.xml', nativeId: '10', preconditionHash: 'b'.repeat(64) },
            components: [],
            content: {
              pictureDocument: { componentId: 'picComp' },
              media: { src: '/uploads/sample.png' },
            },
          },
        },
        instances: {
          'pic-inst': {
            id: 'pic-inst',
            definitionId: 'picDef',
            slideId: 's1',
            parentInstanceId: null,
            localTransform: [1, 0, 0, 1, 0, 0],
            paintIndex: 0,
            overrides: {
              components: {
                picComp: {
                  picture: { replacement },
                },
              },
            },
          },
        },
        styles: {},
        fonts: {},
      },
    }

    await storage.withUploadHashes((hashes) => {
      hashes['source-pres'] = {
        [replacement.sha256]: {
          filename: 'sample.png',
          originalName: 'sample.png',
          size: 100,
          mimeType: 'image/png',
          uploadedAt: new Date(0).toISOString(),
        },
      }
      delete hashes['dest-pres']
    })

    const token = await rebindPictureReplacementOwnership(presentation, 'source-pres', 'dest-pres')
    expect(token).toMatchObject({ destinationId: 'dest-pres' })
    const updatedInstance = semanticInstance(presentation.pptxSemantic, 'pic-inst')
    expect(
      updatedInstance.overrides.components.picComp.picture.replacement.presentationId
    ).toBe('dest-pres')
  })
})
