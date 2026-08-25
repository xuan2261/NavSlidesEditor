import { buildEditorContractPresentation } from '../../../shared/tests/fixtures/editor-contract-fixtures.js'

export function buildKeyboardControlTraversalSeed() {
  return buildEditorContractPresentation()
}

export const NARROW_RIBBON_VIEWPORTS = Object.freeze([
  { width: 320, height: 720 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
])
