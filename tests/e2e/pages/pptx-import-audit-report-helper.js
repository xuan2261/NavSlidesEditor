import fs from 'node:fs'
import path from 'node:path'
import { ensureAuditRunDirs, sanitizeDiagnosticText } from './pptx-import-audit-helper.js'

export function summarizeTextRootCauses(decks) {
  const buckets = {}
  for (const deck of decks) {
    for (const slide of deck.slides || []) {
      for (const issue of slide.textOverflow || []) {
        const bucket = issue.rootCause || 'unknown/insufficient-source-data'
        buckets[bucket] = (buckets[bucket] || 0) + 1
      }
    }
  }
  return Object.fromEntries(Object.entries(buckets).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
}

export function summarizeDecks(decks) {
  const summary = {
    decks: decks.length,
    slides: 0,
    failedSlides: 0,
    text: 0,
    image: 0,
    intentionalImageCrop: 0,
    rawOutOfCanvas: 0,
    acceptedBleedCandidates: 0,
    acceptedBleed: 0,
    unexpectedOutOfCanvas: 0,
    zero: 0,
    consoleErrors: 0,
    importErrors: 0,
    strictFailures: 0,
    textRootCauses: summarizeTextRootCauses(decks),
  }
  for (const deck of decks) {
    if (deck.importError) summary.importErrors += 1
    summary.consoleErrors += deck.consoleErrors?.length || 0
    summary.slides += deck.slideCount || 0
    for (const slide of deck.slides || []) {
      summary.text += slide.textOverflow.length
      summary.image += slide.imageClipping.length
      summary.intentionalImageCrop += slide.intentionalImageCrop?.length || 0
      summary.rawOutOfCanvas += slide.rawOutOfCanvas.length
      summary.acceptedBleedCandidates += slide.acceptedBleedCandidates.length
      summary.acceptedBleed += slide.acceptedBleed.length
      summary.unexpectedOutOfCanvas += slide.unexpectedOutOfCanvas.length
      summary.zero += slide.zeroSized.length
      if (slide.status !== 'pass') summary.failedSlides += 1
    }
  }
  summary.strictFailures = summary.importErrors + summary.text + summary.image +
    summary.acceptedBleedCandidates + summary.unexpectedOutOfCanvas + summary.zero + summary.consoleErrors
  return summary
}

export function assertStrictAuditSummary(summary) {
  const required = [
    'text',
    'image',
    'acceptedBleedCandidates',
    'unexpectedOutOfCanvas',
    'zero',
    'consoleErrors',
    'importErrors',
    'strictFailures',
  ]
  for (const key of required) {
    if (!Number.isFinite(Number(summary?.[key]))) {
      throw new Error(`PPTX browser audit summary missing numeric ${key}`)
    }
  }
  if (summary.strictFailures !== 0) {
    throw new Error(`PPTX browser audit strict failures: ${summary.strictFailures}`)
  }
  return true
}

function escapeMd(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function summarizeSlide(slide) {
  const issues = [
    ...slide.unexpectedOutOfCanvas.map((item) => `${item.id}:${item.type}:unexpected-out-of-canvas`),
    ...slide.acceptedBleedCandidates.map((item) => `${item.id}:${item.type}:bleed-candidate`),
    ...slide.textOverflow.map((item) => `${item.id}:text-overflow ${item.overflowX}/${item.overflowY}`),
    ...slide.imageClipping.map((item) => `${item.id}:image-clipping ${item.reason}`),
    ...slide.zeroSized.map((item) => `${item.id}:${item.type}:zero-sized`),
  ]
  return issues.length ? issues.join('; ') : 'OK'
}

export function writeAuditReports(paths, metadata, decks) {
  ensureAuditRunDirs(paths)
  const summary = summarizeDecks(decks)
  const sanitizedDecks = decks.map(sanitizeDeckForReport)
  fs.writeFileSync(paths.reportJson, `${JSON.stringify({ metadata, summary, decks: sanitizedDecks }, null, 2)}\n`)
  fs.writeFileSync(`${paths.latestPointer}.tmp`, `${JSON.stringify({ runId: paths.id, reportJson: paths.reportJson }, null, 2)}\n`)
  fs.renameSync(`${paths.latestPointer}.tmp`, paths.latestPointer)

  const lines = [
    '# PPTX Import Real Browser Audit',
    '',
    `Generated: ${metadata.generatedAt}`,
    `Run: ${paths.id}`,
    `Corpus: ${metadata.corpus}`,
    `Strict failures: ${summary.strictFailures}`,
    '',
    '| Deck | Slides | Failed slides | Text | Image | Raw out | Bleed candidates | Unexpected out | Console |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ]
  for (const deck of decks) {
    const totals = summarizeDecks([deck])
    lines.push(`| ${escapeMd(deck.deck)} | ${deck.slideCount} | ${totals.failedSlides} | ${totals.text} | ` +
      `${totals.image} | ${totals.rawOutOfCanvas} | ${totals.acceptedBleedCandidates} | ` +
      `${totals.unexpectedOutOfCanvas} | ${totals.consoleErrors} |`)
  }
  writeSlideTables(lines, decks)
  fs.writeFileSync(paths.reportMd, `${lines.join('\n')}\n`)
}

function sanitizeDeckForReport(deck) {
  return {
    ...deck,
    importError: deck.importError ? sanitizeDiagnosticText(deck.importError) : deck.importError,
    consoleErrors: (deck.consoleErrors || []).map((value) => sanitizeDiagnosticText(value)),
  }
}

function writeSlideTables(lines, decks) {
  for (const deck of decks) {
    lines.push('', `## ${deck.deck}`, '')
    if (deck.importError) {
      lines.push(`Import error: ${escapeMd(deck.importError)}`)
      continue
    }
    lines.push('| Slide | Status | Elements | Text | Image | Raw out | Bleed candidates | Unexpected out | Screenshot |')
    lines.push('| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |')
    for (const slide of deck.slides) {
      lines.push(`| ${slide.index + 1} | ${slide.status} | ${slide.elementCount} | ${slide.textOverflow.length} | ` +
        `${slide.imageClipping.length} | ${slide.rawOutOfCanvas.length} | ${slide.acceptedBleedCandidates.length} | ` +
        `${slide.unexpectedOutOfCanvas.length} | ${escapeMd(path.relative(process.cwd(), slide.screenshot))} |`)
      if (slide.status !== 'pass') lines.push(`|  |  |  |  |  |  |  |  | ${escapeMd(summarizeSlide(slide))} |`)
    }
  }
}
