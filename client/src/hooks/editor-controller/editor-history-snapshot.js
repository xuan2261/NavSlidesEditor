import { isCertifiedSemanticDocument } from 'revealjs-shared/src/pptx-semantic-records.js'

const cloneJson = (value) => JSON.parse(JSON.stringify(value))

// History owns its mutable presentation shell. Only the explicit deep-immutable
// ownership certificate permits sharing the (potentially very large) semantic
// child; Object.freeze/root identity alone proves nothing about descendants.
// This is not admission: restoration must still run full semantic validation.
export function cloneHistorySnapshot(presentation) {
  if (!isCertifiedSemanticDocument(presentation?.pptxSemantic)) return cloneJson(presentation)
  const { pptxSemantic, ...shell } = presentation
  return { ...cloneJson(shell), pptxSemantic }
}
