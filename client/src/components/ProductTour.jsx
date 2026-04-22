import React, { useState } from 'react'
import { Joyride, STATUS } from 'react-joyride'

const ProductTour = () => {
  const [run, setRun] = useState(() => {
    try {
      return !localStorage.getItem('navSlidesTutorialSeen')
    } catch {
      return false
    }
  })

  const handleJoyrideCallback = (data) => {
    const { status } = data
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED]

    if (finishedStatuses.includes(status)) {
      setRun(false)
      localStorage.setItem('navSlidesTutorialSeen', 'true')
    }
  }

  const steps = [
    {
      target: 'body',
      content: (
        <div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: 'var(--text-primary)' }}>
            Welcome to NavSlidesEditor!
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.5',
              color: 'var(--text-secondary)',
            }}
          >
            Let&apos;s take a quick tour to help you get familiar with the interface.
          </p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '.tour-step-quick-access',
      content: (
        <div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: 'var(--text-primary)' }}>
            Menu & Quick Access
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.5',
              color: 'var(--text-secondary)',
            }}
          >
            Access file operations, view options, presentation settings, AI tools, and start your
            slideshow.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '.tour-step-slide-panel',
      content: (
        <div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: 'var(--text-primary)' }}>
            Slide Panel
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.5',
              color: 'var(--text-secondary)',
            }}
          >
            Manage your presentation slides here. Add, delete, duplicate, and reorder your slides.
          </p>
        </div>
      ),
      placement: 'right',
    },
    {
      target: '.tour-step-toolbar',
      content: (
        <div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: 'var(--text-primary)' }}>
            Toolbar
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.5',
              color: 'var(--text-secondary)',
            }}
          >
            Insert elements like text, shapes, images, charts, and control grid settings.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '.tour-step-canvas',
      content: (
        <div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: 'var(--text-primary)' }}>
            Slide Canvas
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.5',
              color: 'var(--text-secondary)',
            }}
          >
            This is your main workspace. Drag, drop, and edit elements directly on the slide.
          </p>
        </div>
      ),
      placement: 'center',
    },
    {
      target: '.tour-step-properties',
      content: (
        <div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: 'var(--text-primary)' }}>
            Properties Panel
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.5',
              color: 'var(--text-secondary)',
            }}
          >
            Customize the selected element&apos;s appearance, position, and advanced settings here.
          </p>
        </div>
      ),
      placement: 'left',
    },
  ]

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showSkipButton={true}
      showProgress={true}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          arrowColor: 'var(--bg-panel)',
          backgroundColor: 'var(--bg-panel)',
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          primaryColor: 'var(--accent)',
          textColor: 'var(--text-primary)',
          zIndex: 99999,
        },
        overlay: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 99999,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        buttonNext: {
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
        last: 'Finish',
        skip: 'Skip Tour',
      }}
    />
  )
}

export default ProductTour
