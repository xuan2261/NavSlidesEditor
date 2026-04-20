import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Replace, X, ChevronUp, ChevronDown, CaseSensitive } from 'lucide-react'

function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  return doc.body.textContent || ''
}

function replaceInHtml(html, searchTerm, replaceTerm, matchCase) {
  const flags = matchCase ? 'g' : 'gi'
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, flags)
  // Parse HTML, walk text nodes, replace
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  function walkTextNodes(node) {
    if (node.nodeType === 3) {
      node.textContent = node.textContent.replace(regex, replaceTerm)
    } else {
      node.childNodes.forEach(walkTextNodes)
    }
  }
  walkTextNodes(doc.body)
  return doc.body.innerHTML
}

export default function FindReplaceBar({
  presentation,
  onUpdatePresentation,
  // eslint-disable-next-line unused-imports/no-unused-vars
  currentSlideIndex,
  onNavigateToSlide,
  onClose,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0)
  const searchRef = useRef(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const matches = []
  if (searchTerm && presentation) {
    const term = matchCase ? searchTerm : searchTerm.toLowerCase()
    presentation.slides.forEach((slide, si) => {
      ;(slide.elements || []).forEach((el) => {
        let text = ''
        if (el.type === 'text') text = stripHtml(el.content)
        else if (el.type === 'code') text = el.content || ''
        else if (el.type === 'shape' && el.text) text = el.text
        else if (el.type === 'markdown') text = el.content || ''
        else if (el.type === 'latex') text = el.content || ''
        else if (el.type === 'html') text = stripHtml(el.content || '')
        const compare = matchCase ? text : text.toLowerCase()
        let pos = 0
        while ((pos = compare.indexOf(term, pos)) !== -1) {
          matches.push({ slideIndex: si, elementId: el.id, elementType: el.type, pos })
          pos += term.length
        }
      })
    })
  }

  const navigateToMatch = useCallback(
    (idx) => {
      if (matches.length === 0) return
      const wrapped = ((idx % matches.length) + matches.length) % matches.length
      setCurrentMatchIdx(wrapped)
      onNavigateToSlide(matches[wrapped].slideIndex)
    },
    [matches, onNavigateToSlide]
  )

  const handleNext = () => navigateToMatch(currentMatchIdx + 1)
  const handlePrev = () => navigateToMatch(currentMatchIdx - 1)

  const handleReplace = () => {
    if (!matches.length || !replaceTerm) return
    const match = matches[currentMatchIdx]
    if (!match) return
    const newSlides = presentation.slides.map((slide, si) => {
      if (si !== match.slideIndex) return slide
      return {
        ...slide,
        elements: slide.elements.map((el) => {
          if (el.id !== match.elementId) return el
          if (el.type === 'text') {
            return { ...el, content: replaceInHtml(el.content, searchTerm, replaceTerm, matchCase) }
          }
          if (el.type === 'code') {
            const flags = matchCase ? '' : 'i'
            const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            return {
              ...el,
              content: (el.content || '').replace(new RegExp(escaped, flags), replaceTerm),
            }
          }
          if (el.type === 'shape') {
            const flags = matchCase ? '' : 'i'
            const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            return { ...el, text: (el.text || '').replace(new RegExp(escaped, flags), replaceTerm) }
          }
          return el
        }),
      }
    })
    onUpdatePresentation({ slides: newSlides })
  }

  const handleReplaceAll = () => {
    if (!matches.length || !replaceTerm) return
    const flags = matchCase ? 'g' : 'gi'
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, flags)
    const newSlides = presentation.slides.map((slide) => ({
      ...slide,
      elements: (slide.elements || []).map((el) => {
        if (el.type === 'text')
          return { ...el, content: replaceInHtml(el.content, searchTerm, replaceTerm, matchCase) }
        if (el.type === 'code')
          return { ...el, content: (el.content || '').replace(regex, replaceTerm) }
        if (el.type === 'shape' && el.text)
          return { ...el, text: el.text.replace(regex, replaceTerm) }
        return el
      }),
    }))
    onUpdatePresentation({ slides: newSlides })
  }

  return (
    <div className="find-replace-bar">
      <div className="find-replace-row">
        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          ref={searchRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setCurrentMatchIdx(0)
          }}
          placeholder="Find..."
          className="find-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.shiftKey ? handlePrev() : handleNext()
            }
            if (e.key === 'Escape') onClose?.()
          }}
        />
        <span className="find-count">
          {matches.length > 0 ? `${currentMatchIdx + 1}/${matches.length}` : '0'}
        </span>
        <button
          className={`btn-icon find-btn ${matchCase ? 'active' : ''}`}
          onClick={() => setMatchCase((v) => !v)}
          title="Match case"
        >
          <CaseSensitive size={14} />
        </button>
        <button className="btn-icon find-btn" onClick={handlePrev} title="Previous">
          <ChevronUp size={14} />
        </button>
        <button className="btn-icon find-btn" onClick={handleNext} title="Next">
          <ChevronDown size={14} />
        </button>
        <button
          className={`btn-icon find-btn ${showReplace ? 'active' : ''}`}
          onClick={() => setShowReplace((v) => !v)}
          title="Toggle replace"
        >
          <Replace size={14} />
        </button>
        <button className="btn-icon find-btn" onClick={onClose} title="Close (Esc)">
          <X size={14} />
        </button>
      </div>
      {showReplace && (
        <div className="find-replace-row">
          <Replace size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            placeholder="Replace..."
            className="find-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleReplace()
            }}
          />
          <button
            className="btn btn-secondary find-action-btn"
            onClick={handleReplace}
            disabled={!matches.length}
          >
            Replace
          </button>
          <button
            className="btn btn-secondary find-action-btn"
            onClick={handleReplaceAll}
            disabled={!matches.length}
          >
            All
          </button>
        </div>
      )}
    </div>
  )
}
