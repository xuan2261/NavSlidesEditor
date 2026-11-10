const { normalizeOmmlDocument } = require('./pptx-omml-document')
const { M } = require('./pptx-omml-document-grammar')

// IDs are authored by the caller and survive journal replay, never regenerated.
function createOmmlStructure(document, type, identity) {
  const source = normalizeOmmlDocument(document)
  if (typeof identity !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(identity))
    throw new TypeError('Explicit authored OMML identity required')
  let serial = 0
  const node = (type, children = [], text) => ({
    componentId: `${source.root.componentId}~authored:${identity}-${++serial}`,
    namespaceUri: M, type, attributes: [], children,
    ...(text === undefined ? {} : { text }),
  })
  const run = () => node('r', [node('t', [], '')])
  const arg = (type) => node(type, [run()])
  let result
  switch (type) {
    case 'r': result = run(); break
    case 'f': result = node(type, [arg('num'), arg('den')]); break
    case 'rad': result = node(type, [node('deg'), arg('e')]); break
    case 'sSub': result = node(type, [arg('e'), arg('sub')]); break
    case 'sSup': result = node(type, [arg('e'), arg('sup')]); break
    case 'sSubSup': result = node(type, [arg('e'), arg('sub'), arg('sup')]); break
    case 'sPre': result = node(type, [arg('sub'), arg('sup'), arg('e')]); break
    case 'nary': result = node(type, [arg('sub'), arg('sup'), arg('e')]); break
    case 'm': result = node(type, [node('mr', [arg('e'), arg('e')]),
      node('mr', [arg('e'), arg('e')])]); break
    case 'd': result = node(type, [arg('e')]); break
    case 'eqArr': result = node(type, [arg('e'), arg('e')]); break
    case 'acc': case 'bar': case 'box': case 'borderBox': case 'groupChr': case 'phant':
      result = node(type, [arg('e')]); break
    case 'func': result = node(type, [arg('fName'), arg('e')]); break
    case 'limLow': case 'limUpp': result = node(type, [arg('e'), arg('lim')]); break
    default: throw new TypeError('Unsupported OMML insertion structure')
  }
  normalizeOmmlDocument({ schemaVersion: 1, root: node('oMath', [result]) })
  return result
}
module.exports = { createOmmlStructure }
