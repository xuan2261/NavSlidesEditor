const model = (typeface = 'KaTeX_Main') => {
  const hash = 'a'.repeat(64)
  return {
    schemaVersion: 1, styles: {}, fonts: {},
    definitions: { d: { id: 'd', kind: 'text',
      source: { partUri: 'ppt/slides/slide1.xml', nativeId: '1', preconditionHash: hash },
      components: ['body', 'paragraph', 'run'].map((id, i) => ({
        id, kind: i === 2 ? 'run' : 'paragraph', locator: { path: [0, i], preconditionHash: hash },
      })),
      content: { textDocument: { schemaVersion: 1, componentId: 'body', body: {},
        paragraphs: [{ componentId: 'paragraph', properties: {},
          defaultRunProperties: { fontLatin: { typeface }, fontSizePt: 18 },
          runs: [{ componentId: 'run', kind: 'text', text: 'Font', properties: {} }] }] } },
    } },
    instances: { i: { id: 'i', slideId: 's', definitionId: 'd', parentInstanceId: null,
      localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} } },
  }
}
module.exports = { model }
