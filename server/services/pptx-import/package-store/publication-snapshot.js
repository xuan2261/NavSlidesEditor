const { isCertifiedSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')

const { sealCanonicalData, isSealedCanonicalData } = require('./canonical-json')

// Kiểm tra/đóng băng một lần, đồng thời cấp proof byte canonical và ownership.
// Caller vẫn phải clone trước vì mutator có thể giữ alias của draft.
function sealPublication(value) {
  sealCanonicalData(value)
  return value
}
function ownPublication(metadata) {
  const state = sealPublication(clone(metadata.state))
  const root = sealPublication(detachedClone(metadata.root))
  metadata.state = state
  metadata.root = root
}

// structuredClone retains holes, which would retain prototype-backed reads.
// Own undefined slots preserve the historical canonical sparse-slot bytes while
// preventing later prototype mutations from changing detached publication data.
function detachedClone(value) {
  const output = structuredClone(value)
  const seen = new WeakSet()
  function detach(node) {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) {
      for (let index = 0; index < node.length; index++) {
        if (!Object.hasOwn(node, index)) Object.defineProperty(node, index, {
          value: undefined, writable: true, enumerable: true, configurable: true,
        })
      }
    }
    for (const child of Object.values(node)) detach(child)
  }
  detach(output)
  return output
}

function clone(value) {
  if (value && typeof value === 'object') {
    const hasMutation = Array.isArray(value.mutationResults)
    const hasOutbox = Array.isArray(value.compatibilityOutbox)
    if (hasMutation || hasOutbox) {
      const { mutationResults, compatibilityOutbox, ...state } = value
      const cloned = detachedClone(state)
      if (hasMutation) {
        cloned.mutationResults = mutationResults.map((result) => {
          const semantic = result.projection?.pptxSemantic
          if (!(isCertifiedSemanticDocument(semantic) && sealCanonicalData(semantic))) return detachedClone(result)
          const { projection, ...record } = result
          const { pptxSemantic: _semantic, ...editable } = projection
          const clonedProj = { ...detachedClone(editable), pptxSemantic: semantic }
          return {
            ...detachedClone(record),
            projection: clonedProj,
          }
        })
      }
      if (hasOutbox) {
        cloned.compatibilityOutbox = compatibilityOutbox.map((write) => {
          const semantic = write.presentation?.pptxSemantic
          if (!(isCertifiedSemanticDocument(semantic) && sealCanonicalData(semantic))) return detachedClone(write)
          const { presentation, ...record } = write
          const { pptxSemantic: _semantic, ...editable } = presentation
          return {
            ...detachedClone(record),
            presentation: { ...detachedClone(editable), pptxSemantic: semantic },
          }
        })
      }
      return cloned
    }
  }
  return detachedClone(value)
}

function isSealedPublication(value) {
  return isSealedCanonicalData(value)
}

module.exports = { clone, sealPublication, ownPublication, isSealedPublication }
