import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Search, Replace, X, ChevronUp, ChevronDown, CaseSensitive } from 'lucide-react'
import { Button } from '../components/ui'
import {
  createSearchRegex,
  replaceAllInSlides,
  replaceInHtml,
  stripHtml,
} from './find-replace-helpers'

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

  const matches = useMemo(() => {
    const nextMatches = []
    if (!searchTerm || !presentation) return nextMatches
    const term = matchCase ? searchTerm : searchTerm.toLowerCase()
    const collect = (el, si, childIndex) => {
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
        nextMatches.push({ slideIndex: si, childIndex, elementId: el.id, elementType: el.type, pos })
        pos += term.length
      }
    }
    presentation.slides.forEach((slide, si) => {
      ;(slide.elements || []).forEach((el) => collect(el, si, undefined))
      // Vertical child slides hold their own elements — search them too so Find
      // is not blind to text living on a vertical stack.
      ;(slide.children || []).forEach((child, ci) => {
        ;(child.elements || []).forEach((el) => collect(el, si, ci))
      })
    })
    return nextMatches
  }, [matchCase, presentation, searchTerm])

  const navigateToMatch = useCallback(
    (idx) => {
      if (matches.length === 0) return
      const wrapped = ((idx % matches.length) + matches.length) % matches.length
      setCurrentMatchIdx(wrapped)
      onNavigateToSlide(matches[wrapped].slideIndex, matches[wrapped].childIndex)
    },
    [matches, onNavigateToSlide]
  )

  const handleNext = () => navigateToMatch(currentMatchIdx + 1)
  const handlePrev = () => navigateToMatch(currentMatchIdx - 1)

  const handleReplace = () => {
    if (!matches.length) return
    const match = matches[currentMatchIdx]
    if (!match) return
    const singleMatchRegex = createSearchRegex(searchTerm, matchCase, false)
    const replaceOne = (el) => {
      if (el.id !== match.elementId) return el
      if (el.type === 'text') {
        return {
          ...el,
          content: replaceInHtml(el.content, searchTerm, replaceTerm, matchCase, false),
        }
      }
      if (el.type === 'code') {
        return { ...el, content: (el.content || '').replace(singleMatchRegex, replaceTerm) }
      }
      if (el.type === 'markdown' || el.type === 'latex') {
        return { ...el, content: (el.content || '').replace(singleMatchRegex, replaceTerm) }
      }
      if (el.type === 'html') {
        return {
          ...el,
          content: replaceInHtml(el.content || '', searchTerm, replaceTerm, matchCase, false),
        }
      }
      if (el.type === 'shape') {
        return { ...el, text: (el.text || '').replace(singleMatchRegex, replaceTerm) }
      }
      return el
    }
    const newSlides = presentation.slides.map((slide, si) => {
      if (si !== match.slideIndex) return slide
      // childIndex set → the match lives on a vertical child; rewrite there and
      // leave the parent's own elements untouched (and vice versa).
      if (match.childIndex != null) {
        return {
          ...slide,
          children: (slide.children || []).map((child, ci) =>
            ci === match.childIndex
              ? { ...child, elements: (child.elements || []).map(replaceOne) }
              : child
          ),
        }
      }
      return { ...slide, elements: (slide.elements || []).map(replaceOne) }
    })
    onUpdatePresentation({ slides: newSlides })
  }

  const handleReplaceAll = () => {
    if (!matches.length) return
    const newSlides = replaceAllInSlides(presentation.slides, searchTerm, replaceTerm, matchCase)
    onUpdatePresentation({ slides: newSlides })
  }

  const resultMessage = searchTerm
    ? matches.length > 0
      ? `${matches.length} match${matches.length === 1 ? '' : 'es'} found`
      : 'No matches found'
    : 'Enter text to search'

  return (
    <div className="find-replace-bar absolute left-2.5 right-2.5 top-[46px] z-[9990] flex w-auto max-w-[520px] flex-col gap-1.5 rounded-b-md border border-border bg-card p-2 shadow-[0_14px_36px_rgba(0,0,0,0.22)] sm:left-auto sm:w-[min(520px,calc(100vw-1.25rem))]">
      <div className="flex flex-wrap items-center gap-1.5">
        <Search size={14} className="text-text-muted shrink-0" />
        <input
          ref={searchRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setCurrentMatchIdx(0)
          }}
          placeholder="Find..."
          className="find-input min-w-0 flex-1 rounded border border-border bg-secondary px-2 py-1 text-[13px] text-text-primary outline-none transition-[border-color,box-shadow] duration-150 focus:border-focus focus:ring-2 focus:ring-focus/25"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.shiftKey ? handlePrev() : handleNext()
            }
            if (e.key === 'Escape') onClose?.()
          }}
        />
        <span className="find-count text-[11px] text-text-muted whitespace-nowrap min-w-[30px] text-center">
          {matches.length > 0 ? `${currentMatchIdx + 1}/${matches.length}` : '0'}
        </span>
        <Button
          variant="ghost"
          className={`find-btn h-8 w-8 p-0 shrink-0 sm:h-6 sm:w-6 ${matchCase ? 'bg-accent text-white hover:bg-accent' : ''}`}
          onClick={() => setMatchCase((v) => !v)}
          title="Match case"
          aria-pressed={matchCase}
        >
          <CaseSensitive size={14} />
        </Button>
        <Button
          variant="icon"
          className="find-btn h-8 w-8 p-0 shrink-0 sm:h-6 sm:w-6"
          onClick={handlePrev}
          title="Previous"
        >
          <ChevronUp size={14} />
        </Button>
        <Button
          variant="icon"
          className="find-btn h-8 w-8 p-0 shrink-0 sm:h-6 sm:w-6"
          onClick={handleNext}
          title="Next"
        >
          <ChevronDown size={14} />
        </Button>
        <Button
          variant="ghost"
          className={`find-btn h-8 w-8 p-0 shrink-0 sm:h-6 sm:w-6 ${showReplace ? 'bg-accent text-white hover:bg-accent' : ''}`}
          onClick={() => setShowReplace((v) => !v)}
          title="Toggle replace"
          aria-pressed={showReplace}
        >
          <Replace size={14} />
        </Button>
        <Button
          variant="icon"
          className="find-btn h-8 w-8 p-0 shrink-0 sm:h-6 sm:w-6"
          onClick={onClose}
          title="Close (Esc)"
        >
          <X size={14} />
        </Button>
      </div>
      {showReplace && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Replace size={14} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            placeholder="Replace..."
            className="min-w-0 flex-1 rounded border border-border bg-secondary px-2 py-1 text-[13px] text-text-primary outline-none transition-[border-color,box-shadow] duration-150 focus:border-focus focus:ring-2 focus:ring-focus/25"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleReplace()
            }}
          />
          <Button
            variant="secondary"
            className="h-7 text-[11px] px-2.5 whitespace-nowrap"
            onClick={handleReplace}
            disabled={!matches.length}
          >
            Replace
          </Button>
          <Button
            variant="secondary"
            className="h-7 text-[11px] px-2.5 whitespace-nowrap"
            onClick={handleReplaceAll}
            disabled={!matches.length}
          >
            All
          </Button>
        </div>
      )}
      <div
        className={`px-5 text-[11px] ${searchTerm && matches.length === 0 ? 'text-warning' : 'text-text-muted'}`}
        role="status"
        aria-live="polite"
      >
        {resultMessage}
      </div>
    </div>
  )
}
