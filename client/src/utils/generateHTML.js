import * as shared from 'revealjs-shared'
import { showError } from './app-feedback'

export const { generateRevealHTML, getBackgroundAttrs, escapeHtml } = shared

function runWithFeedback(action, operation) {
  try {
    return operation()
  } catch (error) {
    console.error(`${action}:`, error)
    showError(`${action}: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

export function downloadHTML(presentation) {
  return runWithFeedback('HTML export failed', () => shared.downloadHTML(presentation))
}

export function exportPDF(presentation) {
  return runWithFeedback('PDF export failed', () => shared.exportPDF(presentation))
}

export function presentInWindow(presentation, options) {
  return runWithFeedback('Failed to present', () => shared.presentInWindow(presentation, options))
}
