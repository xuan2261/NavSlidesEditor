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
          nextMatches.push({ slideIndex: si, elementId: el.id, elementType: el.type, pos })
          pos += term.length
        }
      })
    })
    return nextMatches
  }, [matchCase, presentation, searchTerm])

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
    if (!matches.length) return
    const match = matches[currentMatchIdx]
    if (!match) return
    const singleMatchRegex = createSearchRegex(searchTerm, matchCase, false)
    const newSlides = presentation.slides.map((slide, si) => {
      if (si !== match.slideIndex) return slide
      return {
        ...slide,
        elements: (slide.elements || []).map((el) => {
          if (el.id !== match.elementId) return el
          if (el.type === 'text') {
            return {
              ...el,
              content: replaceInHtml(el.content, searchTerm, replaceTerm, matchCase, false),
            }
          }
          if (el.type === 'code') {
            return {
              ...el,
              content: (el.content || '').replace(singleMatchRegex, replaceTerm),
            }
          }
          if (el.type === 'markdown' || el.type === 'latex') {
            return {
              ...el,
              content: (el.content || '').replace(singleMatchRegex, replaceTerm),
            }
          }
          if (el.type === 'html') {
            return {
              ...el,
              content: replaceInHtml(el.content || '', searchTerm, replaceTerm, matchCase, false),
            }
          }
          if (el.type === 'shape') {
            return {
              ...el,
              text: (el.text || '').replace(singleMatchRegex, replaceTerm),
            }
          }
          return el
        }),
      }
    })
    onUpdatePresentation({ slides: newSlides })
  }

  const handleReplaceAll = () => {
    if (!matches.length) return
    const newSlides = replaceAllInSlides(presentation.slides, searchTerm, replaceTerm, matchCase)
    onUpdatePresentation({ slides: newSlides })
  }

  return (
    <div className="find-replace-bar absolute top-[46px] right-2.5 z-[9990] bg-card border border-border rounded-b-md p-2 shadow-md flex flex-col gap-1.5 min-w-[380px]">
      <div className="flex items-center gap-1.5">
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
          className="find-input flex-1 bg-secondary border border-border text-text-primary py-1 px-2 rounded text-[13px] outline-none min-w-0 focus:border-accent"
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
          className={`find-btn h-6 w-6 p-0 shrink-0 ${matchCase ? 'bg-accent text-white hover:bg-accent' : ''}`}
          onClick={() => setMatchCase((v) => !v)}
          title="Match case"
        >
          <CaseSensitive size={14} />
        </Button>
        <Button
          variant="icon"
          className="find-btn h-6 w-6 p-0 shrink-0"
          onClick={handlePrev}
          title="Previous"
        >
          <ChevronUp size={14} />
        </Button>
        <Button
          variant="icon"
          className="find-btn h-6 w-6 p-0 shrink-0"
          onClick={handleNext}
          title="Next"
        >
          <ChevronDown size={14} />
        </Button>
        <Button
          variant="ghost"
          className={`find-btn h-6 w-6 p-0 shrink-0 ${showReplace ? 'bg-accent text-white hover:bg-accent' : ''}`}
          onClick={() => setShowReplace((v) => !v)}
          title="Toggle replace"
        >
          <Replace size={14} />
        </Button>
        <Button
          variant="icon"
          className="find-btn h-6 w-6 p-0 shrink-0"
          onClick={onClose}
          title="Close (Esc)"
        >
          <X size={14} />
        </Button>
      </div>
      {showReplace && (
        <div className="flex items-center gap-1.5">
          <Replace size={14} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            placeholder="Replace..."
            className="flex-1 bg-secondary border border-border text-text-primary py-1 px-2 rounded text-[13px] outline-none min-w-0 focus:border-accent"
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
    </div>
  )
}
