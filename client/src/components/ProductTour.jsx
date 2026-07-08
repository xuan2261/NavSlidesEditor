import React, { useState, useEffect, useCallback } from 'react'
import { Joyride, ACTIONS, EVENTS, STATUS } from 'react-joyride'

const TOUR_STORAGE_KEY = 'navSlidesTutorialSeen'

/**
 * Tour z-index must sit above every layer in the app:
 *  - Modals / overlays:  z-[10000]
 *  - DropdownMenu:       z-[9999]
 *  - SlidePanel ctx:     z-[9999]
 *  - Ribbon popups:      z-[1000]
 *  - Ribbon header:      z-[200]
 *  - Ribbon panel:       z-[100]
 */
const TOUR_Z_INDEX = 100001

const TOUR_STEPS = [
  {
    target: 'body',
    content: (
      <div>
        <h3 className="mb-2.5 text-lg text-text-primary">Welcome to NavSlidesEditor!</h3>
        <p className="text-sm leading-relaxed text-text-secondary">
          Let&apos;s take a quick tour to help you get familiar with the interface.
        </p>
      </div>
    ),
    placement: 'center',
    skipBeacon: true,
    isFixed: true,
  },
  {
    target: '.tour-step-quick-access',
    content: (
      <div>
        <h3 className="mb-2.5 text-base text-text-primary">Menu & Quick Access</h3>
        <p className="text-sm leading-relaxed text-text-secondary">
          Access file operations, view options, presentation settings, AI tools, and start your
          slideshow.
        </p>
      </div>
    ),
    placement: 'bottom-end',
    skipBeacon: true,
    isFixed: true,
  },
  {
    target: '.tour-step-slide-panel',
    content: (
      <div>
        <h3 className="mb-2.5 text-base text-text-primary">Slide Panel</h3>
        <p className="text-sm leading-relaxed text-text-secondary">
          Manage your presentation slides here. Add, delete, duplicate, and reorder your slides.
        </p>
      </div>
    ),
    placement: 'right',
    skipBeacon: true,
    isFixed: true,
  },
  {
    target: '.tour-step-ribbon',
    content: (
      <div>
        <h3 className="mb-2.5 text-base text-text-primary">Ribbon</h3>
        <p className="text-sm leading-relaxed text-text-secondary">
          Insert elements like text, shapes, images, charts, and control grid settings.
        </p>
      </div>
    ),
    placement: 'bottom-start',
    skipBeacon: true,
    isFixed: true,
  },
  {
    target: '.tour-step-ribbon',
    content: (
      <div>
        <h3 className="mb-2.5 text-base text-text-primary">Teaching tools</h3>
        <p className="text-sm leading-relaxed text-text-secondary">
          Open Insert to add Mermaid diagrams, STEM simulations, LaTeX/TikZ math, technical
          symbols, and classroom games.
        </p>
      </div>
    ),
    placement: 'bottom-start',
    skipBeacon: true,
    isFixed: true,
  },
  {
    target: '.tour-step-canvas',
    content: (
      <div>
        <h3 className="mb-2.5 text-base text-text-primary">Slide Canvas</h3>
        <p className="text-sm leading-relaxed text-text-secondary">
          This is your main workspace. Drag, drop, and edit elements directly on the slide.
        </p>
      </div>
    ),
    placement: 'center',
    skipBeacon: true,
    isFixed: true,
  },
  {
    target: '.tour-step-properties',
    content: (
      <div>
        <h3 className="mb-2.5 text-base text-text-primary">Properties Panel</h3>
        <p className="text-sm leading-relaxed text-text-secondary">
          Customize the selected element&apos;s appearance, position, and advanced settings here.
        </p>
      </div>
    ),
    placement: 'left',
    skipBeacon: true,
    isFixed: true,
  },
]

const shouldTourRun = () => {
  try {
    return !localStorage.getItem(TOUR_STORAGE_KEY)
  } catch {
    return false
  }
}

const persistTourSeen = () => {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true')
  } catch {
    // Ignore storage failures
  }
}

const MOUNT_DELAY_MS = 800

const ProductTour = () => {
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  // Delay tour start so all DOM targets are mounted and positioned
  useEffect(() => {
    if (!shouldTourRun()) return
    const timer = setTimeout(() => setRun(true), MOUNT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  // v3 uses onEvent instead of callback
  const handleEvent = useCallback((data) => {
    const { action, type, status, index } = data

    // Tour completed or skipped
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false)
      persistTourSeen()
      return
    }

    // In controlled mode, advance step index after each step
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        setStepIndex(index + 1)
      } else if (action === ACTIONS.PREV) {
        setStepIndex(index - 1)
      }
    }

    // Handle close action (e.g. clicking X)
    if (action === ACTIONS.CLOSE) {
      setRun(false)
      persistTourSeen()
    }
  }, [])

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      stepIndex={stepIndex}
      continuous
      skipScroll
      onEvent={handleEvent}
      options={{
        skipBeacon: true,
        blockTargetInteraction: true,
        overlayClickAction: false,
        dismissKeyAction: false,
        spotlightPadding: 12,
        showProgress: true,
        buttons: ['back', 'skip', 'primary'],
        arrowColor: 'var(--bg-panel)',
        backgroundColor: 'var(--bg-panel)',
        overlayColor: 'rgba(0, 0, 0, 0.45)',
        primaryColor: 'var(--accent)',
        textColor: 'var(--text-primary)',
        zIndex: TOUR_Z_INDEX,
      }}
      styles={{
        tooltipContainer: {
          textAlign: 'left',
        },
        buttonPrimary: {
          backgroundColor: 'var(--accent)',
          borderRadius: '4px',
          color: '#ffffff',
          padding: '8px 16px',
        },
        buttonBack: {
          color: 'var(--text-secondary)',
          marginRight: '10px',
        },
        buttonSkip: {
          color: 'var(--text-secondary)',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip Tour',
      }}
    />
  )
}

export default ProductTour
