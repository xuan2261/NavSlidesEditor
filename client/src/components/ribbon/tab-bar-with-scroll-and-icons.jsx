import * as Tabs from '@radix-ui/react-tabs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'
import { useUIStore } from '../../stores/ui-store'
import { RIBBON_TABS, formatTabLabel } from './ribbon-tabs-config'

const EMPTY_SCROLL_STATE = {
  hasOverflow: false,
  canScrollLeft: false,
  canScrollRight: false,
}

function readScrollState(node) {
  if (!node) return EMPTY_SCROLL_STATE
  const style = window.getComputedStyle(node)
  const inlinePadding =
    (Number.parseFloat(style.paddingLeft) || 0) +
    (Number.parseFloat(style.paddingRight) || 0)
  const contentWidth = Math.max(0, node.scrollWidth - inlinePadding)
  const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth)
  const scrollLeft = Math.max(0, node.scrollLeft)
  const hasOverflow = contentWidth > node.clientWidth + 1
  return {
    hasOverflow,
    canScrollLeft: hasOverflow && scrollLeft > 1,
    canScrollRight: hasOverflow && scrollLeft < maxScrollLeft - 1,
  }
}

function sameScrollState(left, right) {
  return (
    left.hasOverflow === right.hasOverflow &&
    left.canScrollLeft === right.canScrollLeft &&
    left.canScrollRight === right.canScrollRight
  )
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function TabBar({ activeTab }) {
  const formatContext = useUIStore((s) => s.formatContext)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const listRef = useRef(null)
  const triggerRefs = useRef(new Map())
  const restoreContextualFocusRef = useRef(false)
  const measureFrameRef = useRef(null)
  const tabTouchStartRef = useRef(null)
  const [scrollState, setScrollState] = useState(EMPTY_SCROLL_STATE)


  const tabs = RIBBON_TABS.filter(
    (tab) => tab.id !== 'format' || formatContext.hasSelection
  )
  const visibleTabKey = tabs.map((tab) => tab.id).join('|')
  const rememberTabTouch = (event, tabId) => {
    const touch = event.changedTouches[0]
    tabTouchStartRef.current = touch
      ? { tabId, x: touch.clientX, y: touch.clientY }
      : null
  }
  const activateTabTouch = (event, tabId) => {
    const start = tabTouchStartRef.current
    const touch = event.changedTouches[0]
    tabTouchStartRef.current = null
    if (!start || !touch || start.tabId !== tabId) return
    if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) return
    setActiveTab(tabId)
  }

  const measureScrollState = useCallback(() => {
    const next = readScrollState(listRef.current)
    setScrollState((current) => (sameScrollState(current, next) ? current : next))
  }, [])

  const scheduleScrollMeasure = useCallback(() => {
    if (measureFrameRef.current != null) return
    const schedule = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0))
    measureFrameRef.current = schedule(() => {
      measureFrameRef.current = null
      measureScrollState()
    })
  }, [measureScrollState])

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return undefined

    measureScrollState()
    list.addEventListener('scroll', scheduleScrollMeasure, { passive: true })
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(scheduleScrollMeasure)
    observer?.observe(list)
    window.addEventListener('resize', scheduleScrollMeasure)

    return () => {
      list.removeEventListener('scroll', scheduleScrollMeasure)
      observer?.disconnect()
      window.removeEventListener('resize', scheduleScrollMeasure)
      if (measureFrameRef.current != null) {
        const cancel = window.cancelAnimationFrame || window.clearTimeout
        cancel(measureFrameRef.current)
        measureFrameRef.current = null
      }
    }
  }, [measureScrollState, scheduleScrollMeasure])

  useLayoutEffect(() => {
    const activeTrigger = triggerRefs.current.get(activeTab)
    if (!activeTrigger) return

    activeTrigger.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    measureScrollState()
  }, [activeTab, formatContext.elementType, measureScrollState, visibleTabKey])

  useLayoutEffect(() => {
    if (!restoreContextualFocusRef.current) return

    const activeTrigger =
      triggerRefs.current.get(activeTab) || triggerRefs.current.get('home')
    activeTrigger?.focus({ preventScroll: true })
    restoreContextualFocusRef.current = false
  }, [activeTab, visibleTabKey])

  const scrollTabs = useCallback(
    (direction) => {
      const list = listRef.current
      if (!list) return
      const left = direction * list.clientWidth * 0.8
      const options = {
        left,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      }
      if (typeof list.scrollBy === 'function') list.scrollBy(options)
      else list.scrollLeft += left
      scheduleScrollMeasure()
    },
    [scheduleScrollMeasure]
  )

  return (
    <div className="ribbon-tab-strip relative flex min-w-0 flex-1 items-stretch bg-secondary">
      {scrollState.hasOverflow && (
        <button
          type="button"
          className="ui-coarse-target ui-coarse-target-square ribbon-tab-scroll-button"
          data-direction="left"
          data-testid="ribbon-tabs-scroll-left"
          aria-label="Scroll ribbon tabs left"
          aria-controls="ribbon-tab-list"
          disabled={!scrollState.canScrollLeft}
          onClick={() => scrollTabs(-1)}
          title="Scroll ribbon tabs left"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
      )}
      <Tabs.List
        ref={listRef}
        id="ribbon-tab-list"
        data-overflow={scrollState.hasOverflow}
        className="ribbon-tab-list flex min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden bg-secondary"
        aria-label="Ribbon tabs"
        aria-orientation="horizontal"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const label =
            tab.id === 'format' ? formatTabLabel(formatContext.elementType) : tab.label
          return (
            <Tabs.Trigger
              key={tab.id}
              ref={(node) => {
                if (node) {
                  triggerRefs.current.set(tab.id, node)
                  return
                }
                const removedTrigger = triggerRefs.current.get(tab.id)
                if (tab.id === 'format' && document.activeElement === removedTrigger) {
                  restoreContextualFocusRef.current = true
                }
                triggerRefs.current.delete(tab.id)
              }}
              value={tab.id}
              id={`ribbon-tab-${tab.id}`}
              data-testid={`ribbon-tab-${tab.id}`}
              aria-label={label}
              aria-controls={`ribbon-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              onTouchStart={(event) => rememberTabTouch(event, tab.id)}
              onTouchEnd={(event) => activateTabTouch(event, tab.id)}
              onTouchCancel={() => { tabTouchStartRef.current = null }}
              className={cn(
                'ui-coarse-target flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-medium transition-colors',
                'border-b-2 -mb-px outline-none focus-visible:ring-2 focus-visible:ring-focus',
                isActive
                  ? 'border-primary text-text-primary bg-panel'
                  : 'border-transparent text-text-muted hover:text-text-primary hover:bg-hover'
              )}
            >
              <Icon size={14} aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </Tabs.Trigger>
          )
        })}
      </Tabs.List>
      {scrollState.hasOverflow && (
        <button
          title="Scroll ribbon tabs right"
          type="button"
          className="ui-coarse-target ui-coarse-target-square ribbon-tab-scroll-button"
          data-direction="right"
          data-testid="ribbon-tabs-scroll-right"
          aria-label="Scroll ribbon tabs right"
          aria-controls="ribbon-tab-list"
          disabled={!scrollState.canScrollRight}
          onClick={() => scrollTabs(1)}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
