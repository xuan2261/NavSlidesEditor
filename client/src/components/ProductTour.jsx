import React, { useState } from 'react';
import { Joyride, STATUS } from 'react-joyride';

const ProductTour = () => {
  const [run, setRun] = useState(() => {
    try {
      return !localStorage.getItem('navSlidesTutorialSeen');
    } catch {
      return false;
    }
  });

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem('navSlidesTutorialSeen', 'true');
    }
  };

  const steps = [
    {
      target: 'body',
      content: (
        <div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#e2e8f0' }}>Welcome to NavSlidesEditor!</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
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
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#e2e8f0' }}>Menu & Quick Access</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
            Access file operations, view options, presentation settings, AI tools, and start your slideshow.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '.tour-step-slide-panel',
      content: (
        <div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#e2e8f0' }}>Slide Panel</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
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
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#e2e8f0' }}>Toolbar</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
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
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#e2e8f0' }}>Slide Canvas</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
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
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#e2e8f0' }}>Properties Panel</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
            Customize the selected element&apos;s appearance, position, and advanced settings here.
          </p>
        </div>
      ),
      placement: 'left',
    }
  ];

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
          arrowColor: '#1e293b',
          backgroundColor: '#1e293b',
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          primaryColor: '#6366f1',
          textColor: '#e2e8f0',
          zIndex: 99999,
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        buttonNext: {
          backgroundColor: '#6366f1',
          borderRadius: '4px',
          color: '#ffffff',
          padding: '8px 16px',
        },
        buttonBack: {
          color: '#94a3b8',
          marginRight: '10px',
        },
        buttonSkip: {
          color: '#94a3b8',
        }
      }}
      locale={{
        last: 'Finish',
        skip: 'Skip Tour'
      }}
    />
  );
};

export default ProductTour;
