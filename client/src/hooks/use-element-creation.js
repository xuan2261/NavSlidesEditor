import { useCallback, useEffect, useState } from 'react'
import { createElement } from '../utils/element-factory'
import { createGameElement } from '../constants/game-element-types-constants'
import { createPluginElement, loadPlugins } from '../plugins'
import { buildStemSimulationEmbed } from '../utils/stem-embed-presets'
import { sanitizeSvgContent } from '../utils/content-safety'
import { findTechnicalSymbol } from '../data/technical-symbol-packs'

const DEFAULT_HTML = `<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<style>* { box-sizing: border-box; margin: 0; } body { background: transparent; overflow: hidden; }</style>
<svg id="viz" width="100%" height="100%" style="display:block;"></svg>
<script>
const W = window.innerWidth, H = window.innerHeight;
const svg = d3.select('#viz').attr('viewBox', \`0 0 \${W} \${H}\`);
const data = Array.from({length: 30}, () => ({ x: Math.random()*W, y: Math.random()*H, r: 8+Math.random()*20 }));
svg.selectAll('circle').data(data).join('circle')
  .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => d.r)
  .attr('fill', (d,i) => d3.schemeTableau10[i%10]).attr('opacity', 0.8);
</script>`

export const MERMAID_SOURCE_LIMIT = 12000

export const DEFAULT_MERMAID_SOURCE = `flowchart TD
  A[Plan] --> B[Teach]
  B --> C[Check understanding]`

export function buildMermaidEmbedContent(source) {
  const safeSource = String(source || '').slice(0, MERMAID_SOURCE_LIMIT)
  return `<!doctype html><html><head><meta charset="utf-8"><script src="/vendor/mermaid/mermaid.min.js"></script><style>*{box-sizing:border-box}html,body{margin:0;padding:0;width:100%;height:100%;overflow:auto;background:transparent;color:#f8fafc;font-family:system-ui,sans-serif}.mermaid{width:100%;min-height:100%;display:flex;align-items:center;justify-content:center;padding:12px}.mermaid svg{max-width:100%;height:auto}.mermaid-error{margin:12px;padding:10px;border:1px solid #f59e0b;border-radius:8px;background:rgba(245,158,11,.12);color:#fde68a;font:13px/1.4 ui-monospace,monospace;white-space:pre-wrap}</style></head><body><pre class="mermaid">${safeSource.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre><script>function showMermaidError(error){document.body.innerHTML='<div class="mermaid-error">Mermaid render error: '+String(error&&error.message||error).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]})+'</div>'}Promise.resolve().then(function(){mermaid.initialize({startOnLoad:true,securityLevel:'strict',theme:'dark'});return mermaid.run()}).catch(showMermaidError)</script></body></html>`
}

/**
 * Element-creation handlers extracted from EditorPage. Orchestrates the
 * element/game/plugin factories and the html/code/latex editor-open + commit
 * flows. All element writes route through mapActiveSlide so they target the
 * active vertical child when one is being edited, not the parent.
 *
 * @param {Object} deps
 * @param {(prev:Object, fn:(slide:Object)=>Object)=>Object} deps.mapActiveSlide
 * @param {() => Object|undefined} deps.getActiveSlide - current active slide
 * @param {Function} deps.setPresentation
 * @param {Function} deps.setSelectedElementIds
 * @param {Function} deps.updateElement
 * @param {Object|null} deps.htmlEditorState
 * @param {Function} deps.setHtmlEditorState
 * @param {Object|null} deps.codeEditorState
 * @param {Function} deps.setCodeEditorState
 * @param {Object|null} deps.latexEditorState
 * @param {Function} deps.setLatexEditorState
 */
export function useElementCreation({
  mapActiveSlide,
  getActiveSlide,
  setPresentation,
  setSelectedElementIds,
  updateElement,
  htmlEditorState,
  setHtmlEditorState,
  codeEditorState,
  setCodeEditorState,
  latexEditorState,
  setLatexEditorState,
}) {
  const [pluginTypes, setPluginTypes] = useState([])

  // Single appender for all factory-built elements (DRY: was duplicated three
  // times for addElement/addGameElement/addPluginElement). Routes through
  // mapActiveSlide so a new element lands on the active vertical child when one
  // is being edited, not the parent.
  const appendElement = useCallback(
    (newEl) => {
      if (getActiveSlide()?.locked) return null
      setPresentation((prev) =>
        mapActiveSlide(prev, (s) => ({ ...s, elements: [...(s.elements || []), newEl] }))
      )
      setSelectedElementIds([newEl.id])
      return newEl
    },
    [getActiveSlide, setPresentation, setSelectedElementIds, mapActiveSlide]
  )

  const addElement = useCallback(
    (type, overrides = {}) => appendElement(createElement(type, overrides)),
    [appendElement]
  )

  const addTextElement = useCallback(() => addElement('text'), [addElement])

  const addImageElement = useCallback(
    (src, dropX, dropY) => {
      const posOverrides = { src }
      if (dropX !== undefined) posOverrides.x = Math.max(0, Math.min(560, dropX - 200))
      if (dropY !== undefined) posOverrides.y = Math.max(0, Math.min(240, dropY - 150))
      return addElement('image', posOverrides)
    },
    [addElement]
  )

  const addQrCodeElement = useCallback(() => addElement('qrcode'), [addElement])

  const addTimelineElement = useCallback(
    () =>
      addElement('timeline', {
        timelineStart: '2000',
        timelineEnd: '2025',
        startDate: '2000',
        endDate: '2025',
        tickSpacing: 'auto',
        lineColor: '#6366f1',
        dotColor: '#6366f1',
        textColor: '#ffffff',
        fontSize: 11,
        events: [],
        items: [],
      }),
    [addElement]
  )

  const insertEmbedHtml = useCallback(
    (html) => {
      addElement('html', { content: html })
    },
    [addElement]
  )

  const handleInsertFromFileBrowser = useCallback(
    (file) => {
      if (file.type === 'image') addElement('image', { src: file.src })
      else if (file.type === 'video') addElement('video', { src: file.src })
      else if (file.type === 'audio') addElement('audio', { src: file.src })
    },
    [addElement]
  )

  const addDividerElement = useCallback(
    () =>
      addElement('line', {
        x: 96,
        y: 270,
        width: 768,
        height: 40,
        x1: 0,
        y1: 20,
        x2: 768,
        y2: 20,
        stroke: 'rgba(255,255,255,0.3)',
        arrowStart: 'none',
        arrowEnd: 'none',
      }),
    [addElement]
  )

  const addGameElement = useCallback(
    (gameType) => appendElement(createGameElement(gameType)),
    [appendElement]
  )

  const addPluginElement = useCallback(
    (fullType) => appendElement(createPluginElement(fullType)),
    [appendElement]
  )

  useEffect(() => {
    let cancelled = false
    loadPlugins().then((types) => {
      if (!cancelled) setPluginTypes(types)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const addHtmlElement = useCallback(() => {
    const newEl = addElement('html', { content: DEFAULT_HTML })
    if (!newEl) return
    setHtmlEditorState({ elementId: newEl.id, content: DEFAULT_HTML })
  }, [addElement, setHtmlEditorState])

  const addMermaidElement = useCallback(() => {
    const content = buildMermaidEmbedContent(DEFAULT_MERMAID_SOURCE)
    const newEl = addElement('html', {
      embedKind: 'mermaid',
      mermaidSource: DEFAULT_MERMAID_SOURCE,
      content,
      width: 420,
      height: 280,
    })
    if (!newEl) return
    setHtmlEditorState({
      elementId: newEl.id,
      embedKind: 'mermaid',
      content,
      mermaidSource: DEFAULT_MERMAID_SOURCE,
    })
  }, [addElement, setHtmlEditorState])

  const addStemSimulationElement = useCallback(
    (providerOrEmbed, source) => {
      const embed =
        typeof providerOrEmbed === 'object'
          ? providerOrEmbed
          : buildStemSimulationEmbed(providerOrEmbed, source)
      return addElement('html', embed)
    },
    [addElement]
  )

  const openHtmlEditor = useCallback(
    (elementId) => {
      const element = getActiveSlide()?.elements?.find((el) => el.id === elementId)
      if (!element || element.type !== 'html') return
      if (getActiveSlide()?.locked || element.locked) return
      if (element.embedKind === 'mermaid') {
        setHtmlEditorState({
          elementId,
          embedKind: 'mermaid',
          content: element.content || buildMermaidEmbedContent(element.mermaidSource),
          mermaidSource: element.mermaidSource || '',
        })
        return
      }
      setHtmlEditorState({ elementId, content: element.content || '' })
    },
    [getActiveSlide, setHtmlEditorState]
  )

  const commitHtmlEdit = useCallback(() => {
    if (!htmlEditorState) return
    if (htmlEditorState.embedKind === 'mermaid') {
      const mermaidSource = String(htmlEditorState.mermaidSource || '').slice(
        0,
        MERMAID_SOURCE_LIMIT
      )
      updateElement(htmlEditorState.elementId, {
        embedKind: 'mermaid',
        mermaidSource,
        content: buildMermaidEmbedContent(mermaidSource),
      })
      setHtmlEditorState(null)
      return
    }
    updateElement(htmlEditorState.elementId, { content: htmlEditorState.content })
    setHtmlEditorState(null)
  }, [htmlEditorState, updateElement, setHtmlEditorState])

  const addCodeElement = useCallback(() => {
    const newEl = addElement('code')
    if (!newEl) return
    setCodeEditorState({ elementId: newEl.id, content: newEl.content, language: newEl.language })
  }, [addElement, setCodeEditorState])

  const openCodeEditor = useCallback(
    (elementId) => {
      const element = getActiveSlide()?.elements?.find((el) => el.id === elementId)
      if (!element || element.type !== 'code') return
      if (getActiveSlide()?.locked || element.locked) return
      setCodeEditorState({
        elementId,
        content: element.content || '',
        language: element.language || 'javascript',
      })
    },
    [getActiveSlide, setCodeEditorState]
  )

  const commitCodeEdit = useCallback(() => {
    if (!codeEditorState) return
    updateElement(codeEditorState.elementId, {
      content: codeEditorState.content,
      language: codeEditorState.language,
    })
    setCodeEditorState(null)
  }, [codeEditorState, updateElement, setCodeEditorState])

  const addLatexElement = useCallback(() => {
    const newEl = addElement('latex')
    if (!newEl) return
    setLatexEditorState({
      elementId: newEl.id,
      content: newEl.content,
      fontSize: newEl.fontSize,
      textColor: newEl.textColor,
    })
  }, [addElement, setLatexEditorState])

  const openLatexEditor = useCallback(
    (elementId) => {
      const element = getActiveSlide()?.elements?.find((el) => el.id === elementId)
      if (!element || element.type !== 'latex') return
      if (getActiveSlide()?.locked || element.locked) return
      setLatexEditorState({
        elementId,
        content: element.content || '',
        fontSize: element.fontSize,
        textColor: element.textColor,
      })
    },
    [getActiveSlide, setLatexEditorState]
  )

  const commitLatexEdit = useCallback(() => {
    if (!latexEditorState) return
    updateElement(latexEditorState.elementId, {
      content: latexEditorState.content,
      fontSize: latexEditorState.fontSize,
      textColor: latexEditorState.textColor,
    })
    setLatexEditorState(null)
  }, [latexEditorState, updateElement, setLatexEditorState])

  const addMarkdownElement = useCallback(() => addElement('markdown'), [addElement])

  const addChartElement = useCallback(() => addElement('chart'), [addElement])

  const addCalloutElement = useCallback(
    (number) => {
      const num =
        number ||
        (getActiveSlide()?.elements || []).filter((el) => el.type === 'callout').length + 1
      return addElement('callout', { calloutNumber: num })
    },
    [getActiveSlide, addElement]
  )

  const addIconElement = useCallback(
    (iconName) => addElement('icon', iconName ? { iconName } : {}),
    [addElement]
  )

  const addShapeElement = useCallback(
    (shape) => {
      const dims = { line: { width: 300, height: 40 }, circle: { width: 200, height: 200 } }
      const dim = dims[shape] || { width: 200, height: 150 }
      return addElement('shape', {
        shape,
        x: (960 - dim.width) / 2,
        y: (540 - dim.height) / 2,
        width: dim.width,
        height: dim.height,
      })
    },
    [addElement]
  )

  const addVideoElement = useCallback(
    (src, dropX, dropY) => {
      const posOverrides = { src }
      if (dropX !== undefined) posOverrides.x = Math.max(0, Math.min(480, dropX - 240))
      if (dropY !== undefined) posOverrides.y = Math.max(0, Math.min(270, dropY - 135))
      return addElement('video', posOverrides)
    },
    [addElement]
  )
  const addAudioElement = useCallback(
    (src, dropX, dropY) => {
      const posOverrides = { src }
      if (dropX !== undefined) posOverrides.x = Math.max(0, Math.min(560, dropX - 200))
      if (dropY !== undefined) posOverrides.y = Math.max(0, Math.min(480, dropY - 30))
      return addElement('audio', posOverrides)
    },
    [addElement]
  )

  const addTableElement = useCallback(
    (rows = 3, cols = 3) => {
      const data = Array.from({ length: rows }, (_, ri) =>
        Array.from({ length: cols }, (_, ci) => (ri === 0 ? `Header ${ci + 1}` : ''))
      )
      return addElement('table', { data })
    },
    [addElement]
  )

  const addDrawingElement = useCallback(() => addElement('drawing'), [addElement])
  const addLineElement = useCallback(
    (overrides = {}) => addElement('line', overrides),
    [addElement]
  )
  const addSvgElement = useCallback(
    (svgContent) => addElement('svg', svgContent ? { content: svgContent } : {}),
    [addElement]
  )
  const addTechnicalSymbolElement = useCallback(
    (symbolId) => {
      const symbol = findTechnicalSymbol(symbolId)
      if (!symbol) return null
      const overrides = { ...(symbol.overrides || {}) }
      if (symbol.elementType === 'svg' && overrides.content) {
        overrides.content = sanitizeSvgContent(overrides.content)
      }
      return addElement(symbol.elementType, {
        width: symbol.elementType === 'svg' ? 180 : 120,
        height: symbol.elementType === 'svg' ? 120 : 120,
        ...overrides,
      })
    },
    [addElement]
  )

  return {
    pluginTypes,
    addElement,
    addTextElement,
    addImageElement,
    addQrCodeElement,
    addTimelineElement,
    insertEmbedHtml,
    handleInsertFromFileBrowser,
    addDividerElement,
    addGameElement,
    addPluginElement,
    addHtmlElement,
    addMermaidElement,
    addStemSimulationElement,
    openHtmlEditor,
    commitHtmlEdit,
    addCodeElement,
    openCodeEditor,
    commitCodeEdit,
    addLatexElement,
    openLatexEditor,
    commitLatexEdit,
    addMarkdownElement,
    addChartElement,
    addCalloutElement,
    addIconElement,
    addShapeElement,
    addVideoElement,
    addAudioElement,
    addTableElement,
    addDrawingElement,
    addLineElement,
    addSvgElement,
    addTechnicalSymbolElement,
  }
}
