const { decodeXml } = require('./ooxml-text-run-xml')

// Source XML and every structural child are retained, including unsupported nodes.
// Qualification is a shared, deterministic read of this immutable source record.
function readSemanticTiming({ source, node, xml }) {
  const targetReferences = []
  function visit(current, path) {
    const locator = { path, preconditionHash: source.preconditionHash }
    const attributes = current.attrs.map(({ name, value }) => ({ name, value }))
    if (current.local === 'spTgt' && [
      'http://schemas.openxmlformats.org/presentationml/2006/main',
      'http://purl.oclc.org/ooxml/presentationml/main',
    ].includes(current.uri)) {
      const targets = attributes.filter(entry => entry.name === 'spid')
      const spid = targets.length === 1 ? decodeXml(targets[0].value) : null
      if (typeof spid !== 'string' || !spid.length || spid.length > 1024)
        throw new TypeError('Invalid PPTX timing shape target')
      targetReferences.push({ spid, locator })
    }
    return { namespace: current.uri, name: current.local, attributes, locator,
      text: current.children.length || current.selfClosing ? '' : xml.slice(current.end + 1, current.closeStart),
      children: current.children.map((child, index) => visit(child, [...path, index])) }
  }
  const tree = visit(node, source.componentLocators[0].path)
  return { schemaVersion: 1, xml: xml.slice(node.start, node.closeEnd + 1), tree, targetReferences }
}

module.exports = { readSemanticTiming }
