const { normalizeGameConfig } = require('./normalize-game-config.js')
const { validateGameConfig } = require('./game-schema.js')
const { throwInvalid } = require('./game-validation-utils.js')
const { buildStaticGameContent } = require('./static-game-content.js')
const { resolveColorForTokens } = require('../design-tokens.js')

const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  )
function color(value, fallback) {
  return typeof value === 'string' &&
    /^(#[\da-f]{3,8}|rgba?\([\d.\s,%]+\)|hsla?\([\d.\s,%]+\)|[a-z]+)$/i.test(value.trim())
    ? value.trim()
    : fallback
}
function buildStaticGameSnapshot(element, options = {}) {
  const gameType = element?.gameType
  const config = normalizeGameConfig(element, gameType)
  throwInvalid(validateGameConfig(gameType, config).errors, `${gameType} static snapshot`)
  return {
    gameType,
    title: config.title || gameType,
    ...buildStaticGameContent(gameType, config, { teacherReveal: options.teacherReveal === true }),
  }
}
function renderItem(item, regions) {
  let media = ''
  if (item.media) {
    const overlay = regions?.length
      ? `<svg viewBox="0 0 1 1" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;">${regions
          .map((region) =>
            region.shape === 'rect'
              ? `<rect x="${region.x}" y="${region.y}" width="${region.width}" height="${region.height}" fill="none" stroke="#16a34a" stroke-width="0.015"/>`
              : `<circle cx="${region.cx}" cy="${region.cy}" r="${region.r}" fill="none" stroke="#16a34a" stroke-width="0.015"/>`
          )
          .join('')}</svg>`
      : ''
    media = `<span style="display:inline-block;position:relative;max-width:100%;"><img src="${escape(item.media.src)}" alt="${escape(item.media.alt)}" style="display:block;max-width:100%;max-height:8em;object-fit:contain;"/>${overlay}</span>`
  }
  return `${media}${escape(item.text)}`
}
function renderBoard(board, accent) {
  if (!board) return ''
  if (board.cards)
    return `<div style="display:grid;grid-template-columns:repeat(${Math.ceil(Math.sqrt(board.cards.length))},1fr);gap:0.4em;">${board.cards.map((card) => `<div data-static-card style="text-align:center;border:2px solid ${accent};border-radius:0.4em;padding:0.5em;">${escape(card.text)}</div>`).join('')}</div>`
  return `<table aria-label="Puzzle board" style="border-collapse:collapse;table-layout:fixed;width:100%;text-align:center;"><tbody>${board.rows.map((row) => `<tr>${row.map((cell) => `<td${cell.solution ? ' data-static-solution' : ''} style="position:relative;border:1px solid ${accent};height:1.6em;${cell.blocked ? 'background:#334155;' : cell.solution ? 'background:#dcfce7;color:#14532d;' : ''}">${cell.number ? `<small style="position:absolute;left:0.1em;top:0;font-size:0.45em;">${cell.number}</small>` : ''}<span data-static-cell-letter>${escape(cell.text)}</span></td>`).join('')}</tr>`).join('')}</tbody></table>`
}
function renderStaticGameSnapshot(element, options = {}) {
  const snapshot = buildStaticGameSnapshot(element, options)
  const tokens = options.designTokens
  const resolve = (value, token, fallback) =>
    color(
      value === 'auto'
        ? tokens?.colors?.[token]
        : resolveColorForTokens(value, 'game', token, tokens),
      fallback
    )
  const background = resolve(element.backgroundColor, 'surface', '#1a1a2e')
  const accent = resolve(element.accentColor, 'accent', '#6366f1')
  const text = resolve(element.textColor, 'text', '#ffffff')
  const authoredFont = element.fontFamily || tokens?.fonts?.body
  const font =
    typeof authoredFont === 'string' && /^[\p{L}\p{N}\s,"'-]+$/u.test(authoredFont)
      ? authoredFont
      : 'sans-serif'
  const width = Number(element.width) || 640,
    height = Number(element.height) || 480
  const units = snapshot.sections.reduce(
    (sum, section) =>
      sum +
      1 +
      Math.max(1, Math.ceil(section.label.length / 45)) +
      section.items.reduce(
        (n, item) => n + Math.max(1, Math.ceil(item.text.length / 45)) + (item.media ? 8 : 0),
        0
      ),
    0
  )
  const columns = width >= 500 && snapshot.sections.length > 2 ? 2 : 1
  const boardUnits = snapshot.board?.rows
    ? snapshot.board.rows.length * (snapshot.gameType === 'jeopardy' ? 3 : 1.6)
    : 0
  const fontSize = Math.min(
    Number(element.fontSize) || 18,
    Math.max(
      6,
      (height - 70) /
        Math.max(1, boardUnits, Math.ceil(units / (snapshot.board ? 1 : columns))) /
        1.35
    )
  )
  const sections = snapshot.sections
    .map(
      (section) =>
        `<section data-static-section="${escape(section.label)}"${section.solution ? ' data-static-solution' : ''} style="break-inside:avoid;margin:0 0 0.6em;${section.solution ? `border-left:3px solid ${accent};padding-left:0.4em;` : ''}"><h3 style="font-size:1em;margin:0 0 0.25em;">${escape(section.label)}</h3>${section.items.length ? `<ul style="list-style:none;padding:0;margin:0;">${section.items.map((item) => `<li style="margin:0.2em 0;white-space:pre-wrap;overflow-wrap:anywhere;">${renderItem(item, section.regions)}</li>`).join('')}</ul>` : ''}</section>`
    )
    .join('')
  const notice = `${options.teacherReveal === true ? 'Teacher answer view. ' : ''}Static snapshot — controls, timers and live play are not interactive.`
  return `<div data-static-game="${escape(snapshot.gameType)}" style="width:100%;height:100%;box-sizing:border-box;padding:12px;overflow:hidden;display:flex;flex-direction:column;background:${background};color:${text};font-family:${escape(font)};font-size:${fontSize}px;line-height:1.35;border:1px solid ${accent};border-radius:8px;"><h2 style="flex-shrink:0;font-size:1.25em;margin:0 0 0.6em;">${escape(snapshot.title)}</h2><div style="display:flex;flex:1;min-height:0;overflow:hidden;align-items:flex-start;gap:1em;">${snapshot.board ? `<div style="flex:1;min-width:0;">${renderBoard(snapshot.board, accent)}</div>` : ''}<div style="flex:1;min-width:0;column-count:${snapshot.board ? 1 : columns};column-gap:1em;">${sections}</div></div><small role="note" style="flex-shrink:0;margin-top:0.5em;font-size:0.75em;">${escape(notice)}</small></div>`
}
module.exports = { buildStaticGameSnapshot, renderStaticGameSnapshot }
