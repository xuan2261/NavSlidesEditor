import { getMediaAccessibilityFindings } from 'revealjs-shared'

/** Returns authoring findings without mutating the presentation. */
export function getPresentationAccessibilityFindings(presentation) {
  const findings = []
  for (const [slideIndex, slide] of (presentation?.slides || []).entries()) {
    for (const [childIndex, child] of (slide?.children || []).entries()) {
      for (const element of child?.elements || []) {
        for (const message of getMediaAccessibilityFindings(element)) {
          findings.push({ slideIndex, childIndex, elementId: element?.id || null, message })
        }
      }
    }
    for (const element of slide?.elements || []) {
      for (const message of getMediaAccessibilityFindings(element)) {
        findings.push({ slideIndex, childIndex: null, elementId: element?.id || null, message })
      }
    }
  }
  return findings
}
