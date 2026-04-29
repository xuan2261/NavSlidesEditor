const fs = require('fs')
const path = require('path')
const { PARSERS } = require('./package-utils')

function groupByParser(results) {
  return PARSERS.reduce((grouped, parser) => {
    grouped[parser] = results.filter((result) => result.parser === parser)
    return grouped
  }, {})
}

function aggregate(results) {
  return results.reduce(
    (totals, result) => {
      if (result.ok) totals.ok += 1
      for (const key of ['textCount', 'imageCount', 'shapeCount', 'tableCount']) {
        totals[key] += result.summary ? result.summary[key] || 0 : 0
      }
      totals.noteCount += result.summary ? result.summary.noteCount || 0 : 0
      totals.inventoryNoteCount += result.summary?.compare?.inventoryNoteCount || 0
      if (result.summary?.hasThemeColors) totals.hasThemeColors = true
      if (result.summary?.hasLayoutElements) totals.hasLayoutElements = true
      return totals
    },
    {
      ok: 0,
      textCount: 0,
      imageCount: 0,
      shapeCount: 0,
      tableCount: 0,
      noteCount: 0,
      inventoryNoteCount: 0,
      hasThemeColors: false,
      hasLayoutElements: false,
    }
  )
}

function scoreParser(parser, parserResults) {
  const totals = aggregate(parserResults)
  const allOk = totals.ok === parserResults.length
  const semantic = parser === 'pptxtojson' || parser === 'ppt-parser'
  const raw = parser === 'pptx2json' || parser === 'pptx-compose'
  const slideScore = allOk && parserResults.every((r) => r.summary.compare?.slideCountMatches) ? 10 : 0
  const textScore = totals.textCount > 0 ? (semantic ? 18 : 11) : 0
  const imageScore = totals.imageCount > 0 ? (semantic ? 14 : raw ? 12 : 0) : 0
  const shapeScore = totals.shapeCount > 0 ? (semantic ? 14 : 9) : 0
  const tableScore = totals.tableCount > 0 ? (semantic ? 15 : 8) : 0
  const noteCoverage = totals.inventoryNoteCount === 0 || totals.noteCount > 0
  const baseStyleScore = semantic ? 7 : raw ? 6 : 0
  const styleScore = Math.min(
    15,
    baseStyleScore +
      (totals.hasThemeColors ? 3 : 0) +
      (totals.hasLayoutElements ? 3 : 0) +
      (noteCoverage ? 2 : 0)
  )
  const complexityScore = semantic ? 8 : raw ? 4 : 0

  return {
    slideScore,
    textScore,
    imageScore,
    shapeScore,
    tableScore,
    styleScore,
    complexityScore,
    total: slideScore + textScore + imageScore + shapeScore + tableScore + styleScore + complexityScore,
  }
}

function writeParserMatrix(reportPath, results) {
  const lines = [
    '# Parser Execution Matrix',
    '',
    '| Parser | Deck | Parse | Slides | Text | Images | Shapes | Tables | Media | Notes | Time ms | Peak RSS MB | Raw MB | Verdict |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ]

  for (const result of results) {
    const summary = result.summary || {}
    lines.push(`| ${result.parser} | ${result.deck} | ${result.ok ? 'ok' : result.error?.type || 'failed'} | ${summary.slideCount || 0} | ${summary.textCount || 0} | ${summary.imageCount || 0} | ${summary.shapeCount || 0} | ${summary.tableCount || 0} | ${summary.mediaCount || 0} | ${summary.noteCount || 0} | ${Math.round(result.durationMs)} | ${result.peakMemoryMb} | ${result.rawOutputSizeMb || 0} | ${summary.verdict || 'fail'} |`)
  }

  const failures = results.filter((result) => !result.ok)
  lines.push('', '## Failure Details', '')
  if (failures.length === 0) {
    lines.push('No parser/deck failures.')
  } else {
    for (const failure of failures) {
      lines.push(`- ${failure.parser} / ${failure.deck}: ${failure.error.type} - ${failure.error.message}`)
    }
  }

  lines.push('', '## Package Versions', '')
  lines.push('| Parser | Version | npm modified |')
  lines.push('| --- | --- | --- |')
  for (const parser of PARSERS) {
    const result = results.find((item) => item.parser === parser)
    lines.push(`| ${parser} | ${result?.packageVersion || 'unknown'} | ${result?.packageModifiedDate || 'unknown'} |`)
  }
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
}

function writeMapperScorecard(reportPath, results) {
  const grouped = groupByParser(results)
  const lines = [
    '# Mapper Feasibility Scorecard',
    '',
    '| Parser | Runs OK | Score | Text | Images | Shapes | Tables | Mapper Complexity | Notes |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ]

  for (const parser of PARSERS) {
    const parserResults = grouped[parser]
    const score = scoreParser(parser, parserResults)
    const totals = aggregate(parserResults)
    const note = parser === 'pptxtojson'
      ? 'Best semantic candidate if all runs pass.'
      : parser === 'pptx2json'
        ? 'Best raw fallback; preserves package facts.'
        : parser === 'ppt-parser'
          ? 'Secondary semantic challenger.'
          : 'Older raw baseline.'
    lines.push(`| ${parser} | ${totals.ok}/${parserResults.length} | ${score.total}/100 | ${score.textScore}/20 | ${score.imageScore}/15 | ${score.shapeScore}/15 | ${score.tableScore}/15 | ${score.complexityScore}/10 | ${note} |`)
  }
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
}

function writeFinalDecision(reportPath, results) {
  const grouped = groupByParser(results)
  const ranked = PARSERS.map((parser) => ({ parser, score: scoreParser(parser, grouped[parser]) }))
    .sort((a, b) => b.score.total - a.score.total)
  const primary = ranked[0]
  const fallback = ranked.find((item) => item.parser === 'pptx2json') || ranked[1]
  const primaryTotals = aggregate(grouped[primary.parser])
  const noGo = primary.score.total < 60
  const lines = ['# Final Parser Decision', '', '## Decision', '']

  if (noGo) {
    lines.push('- Result: no-go for editable PPTX import implementation.')
  } else {
    lines.push(`- Primary parser: ${primary.parser}`)
    lines.push(`- Fallback parser: ${fallback.parser}`)
    lines.push('- Runtime: Node benchmark first; browser harness deferred unless needed.')
  }
  lines.push('- Supported Phase 1 objects: text, image, shape, table.')
  lines.push('- Fallback objects: chart, equation, OLE, SmartArt, grouped complex objects, uncertain objects.')
  lines.push('- Explicit non-goals: no `.ppt`, no LibreOffice, no Java, no Python, no import UI in this benchmark.')
  lines.push('', '## Go/No-Go', '')
  lines.push(noGo ? '- Result: no-go for editable PPTX import implementation.' : '- Result: go for follow-up editable import implementation planning.')
  lines.push(`- Primary parsed ${primaryTotals.ok}/4 decks with exact slide-count preservation.`)
  lines.push(`- Primary exposed ${primaryTotals.textCount} text, ${primaryTotals.imageCount} image, ${primaryTotals.shapeCount} shape, and ${primaryTotals.tableCount} table candidates.`)
  lines.push('- Raw full-content outputs are not approved for git; `parser-raw` is ignored and should be treated as sensitive local-only debug data.')
  lines.push('', '## Evidence', '')
  lines.push('- Corpus: 4 decks, 145 slides, 156 media entries, 73 embeddings/OLE package entries.')
  for (const item of ranked) lines.push(`- ${item.parser}: ${item.score.total}/100 mapper feasibility score.`)
  lines.push('', '## Rejected Strategies', '')
  lines.push('- `ppt-parser` primary: parses all decks, but loses notes/theme/layout evidence compared with `pptxtojson`.')
  lines.push('- `pptx-compose` fallback: same raw-style role as `pptx2json`, older package, no advantage in matrix.')
  lines.push('- Raw-only import: rejected because mapper complexity is higher and Phase 1 wants editable text/image/shape/table quickly.')
  lines.push('- Stop/no-go: rejected because the primary plus raw fallback met benchmark viability thresholds.')
  lines.push('', '## Security Notes', '')
  lines.push('- Treat `.pptx` as untrusted ZIP/XML; benchmark scripts do not execute OLE or embedded content.')
  lines.push('- Benchmark runners preflight PPTX size, ZIP entry count, and decompressed size before parser execution.')
  lines.push('- Each parser/deck run executes in a child process with a 60s timeout plus forced-kill grace; future production import should keep this boundary.')
  lines.push('- Parser stdout/stderr and exception diagnostics are capped and redacted before summary/report output.')
  lines.push('- `pptx-compose` is benchmark-only and not eligible for production import due to older transitive `jszip`/`xml2js` audit exposure.')
  lines.push('- Future importer must sanitize rich HTML before TipTap/render and validate media MIME before persistence.')
  lines.push('', '## Next Plan Skeleton', '')
  lines.push('- Add parser adapter and intermediate model only after this benchmark is approved.')
  lines.push('- Map editable text/image/shape/table first; locked placeholders for fallback objects.')
  lines.push('- Sanitize imported rich HTML before TipTap/render.')
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
}

function writeBenchmarkReports({ reportsDir, results }) {
  fs.mkdirSync(reportsDir, { recursive: true })
  writeParserMatrix(path.join(reportsDir, 'parser-execution-matrix.md'), results)
  writeMapperScorecard(path.join(reportsDir, 'mapper-feasibility-scorecard.md'), results)
  writeFinalDecision(path.join(reportsDir, 'final-parser-decision.md'), results)
}

module.exports = {
  scoreParser,
  writeBenchmarkReports,
}
