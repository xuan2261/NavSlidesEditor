/**
 * Generate HTML snippets for presenter tools (theme toggle, font zoom,
 * slide menu plugin, chalkboard/pen plugin).
 * All output is inline HTML — no external React components.
 */

function getPresenterToolsHead(presenterTools) {
  if (!presenterTools) return ''
  const parts = []

  // Slide menu plugin CSS
  if (presenterTools.slideMenu) {
    parts.push('<link rel="stylesheet" href="/vendor/reveal-plugins/menu/menu.css">')
  }

  // Chalkboard custom-controls CSS + overlay/palette fixes
  if (presenterTools.chalkboard) {
    parts.push('<link rel="stylesheet" href="/vendor/reveal-plugins/customcontrols/style.css">')
    parts.push(`<style>
    /* Fix chalkboard overlay: use position:fixed so it covers the full viewport
       regardless of .reveal transforms and centering */
    #notescanvas, #chalkboard {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
    }
    
    /* Original Plugin style for palette and boardhandle (from chalkboard/style.css) */
    div.palette, div.boardhandle {
      position: fixed !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      font-size: 24px !important;
      border-radius: 10px;
      border-top: 4px solid #222; 
      border-bottom: 4px solid #222;
      background: black;
      transition: transform 0.3s;
      z-index: 50;
    }
    
    div.palette {
      left: -10px !important;
      padding-left: 10px;
      border-right: 4px solid #222; 
    }
    
    div.boardhandle {
      right: -10px !important;
      padding-right: 10px;
      border-left: 4px solid #222; 
    }

    /* Fix palette: remove default list bullets that cause a "double column" look */
    .palette, .palette ul, .palette ul li, .boardhandle, .boardhandle ul, .boardhandle ul li { 
      list-style: none !important; 
      list-style-type: none !important; 
    }
    
    div.palette > ul, div.boardhandle > ul { padding: 0 !important; margin: 0 !important; }
    div.palette > ul > li, div.boardhandle > ul > li { cursor: pointer; margin: 10px; text-align: center; }
    div.palette > ul > li:hover { opacity: 0.8; }
    .palette ul li img { vertical-align: middle; }

    /* FIX: Force color boxes to render as solid colored squares without relying on FontAwesome. 
       This prevents the "all light yellow" or missing font glyph bug */
    .palette ul li i.fa-square {
      display: inline-block !important;
      width: 18px !important;
      height: 18px !important;
      background-color: currentColor !important;
      border-radius: 4px !important;
      border: 1px solid rgba(255,255,255,0.2) !important;
      vertical-align: middle;
    }
    .palette ul li i.fa-square::before {
      content: none !important;
    }
    </style>`)
  }

  // Font Awesome CSS (required by Reveal.js Menu and Chalkboard for UI icons)
  if (presenterTools.slideMenu || presenterTools.chalkboard) {
    parts.push('<link rel="stylesheet" href="/vendor/font-awesome/css/all.min.css">')
  }

  // Theme toggle CSS variables
  if (presenterTools.themeToggle !== false) {
    parts.push(`<style>
    [data-theme="light"] .reveal { filter: invert(1) hue-rotate(180deg); background: #ffffff !important; }
    [data-theme="light"] .reveal img, 
    [data-theme="light"] .reveal video, 
    [data-theme="light"] .reveal canvas, 
    [data-theme="light"] .reveal iframe { filter: invert(1) hue-rotate(180deg); }
    </style>`)
  }

  // Presenter toolbar button styles (Always render since fs-btn is now inside it)
  parts.push(`<style>
    .presenter-toolbar { position:fixed; top:10px; right:10px; z-index:100; display:flex; gap:5px; opacity: 0.15; transition: opacity 0.3s ease; }
    .presenter-toolbar:hover { opacity: 1; }
    .presenter-toolbar button {
      background:rgba(0,0,0,0.5); color:white; border:1px solid rgba(255,255,255,0.25);
      border-radius:6px; padding:5px 10px; cursor:pointer; font-size:14px;
      backdrop-filter:blur(4px); transition:background 0.15s;
    }
    .presenter-toolbar button:hover { background:rgba(0,0,0,0.75); }
    :fullscreen .presenter-toolbar { top:10px; }
    :fullscreen #fs-btn, :-webkit-full-screen #fs-btn { display: none; }
    .slide-menu-button, #customcontrols, .reveal .controls, .palette, .boardhandle { opacity: 0.15 !important; transition: opacity 0.3s ease !important; }
    .slide-menu-button:hover, #customcontrols:hover, .reveal .controls:hover, .palette:hover, .boardhandle:hover { opacity: 1 !important; }
    </style>`)

  // Slide menu Tools tab keyboard badge styles
  if (presenterTools.slideMenu) {
    parts.push(`<style>
    .km { display:inline-block; width:28px; height:28px; background:rgba(255,255,255,0.15); border-radius:4px; text-align:center; line-height:28px; margin-right:10px; font-size:14px; font-family:monospace; }
    </style>`)
  }

  return parts.join('\n  ')
}

function getPresenterToolsScripts(presenterTools) {
  if (!presenterTools) return ''
  const parts = []

  if (presenterTools.slideMenu) {
    parts.push('<script src="/vendor/reveal-plugins/menu/menu.js"></script>')
  }
  if (presenterTools.chalkboard) {
    parts.push('<script src="/vendor/reveal-plugins/chalkboard/plugin.js"></script>')
    parts.push('<script src="/vendor/reveal-plugins/customcontrols/plugin.js"></script>')
  }

  return parts.join('\n  ')
}

function getPresenterToolsPlugins(presenterTools) {
  if (!presenterTools) return ''
  const plugins = []
  if (presenterTools.slideMenu) plugins.push('RevealMenu')
  if (presenterTools.chalkboard) plugins.push('RevealChalkboard', 'RevealCustomControls')
  return plugins.length > 0 ? ', ' + plugins.join(', ') : ''
}

function getPresenterToolsConfig(presenterTools) {
  if (!presenterTools) return ''
  const parts = []

  if (presenterTools.slideMenu) {
    parts.push(`
    menu: {
      side: 'left', width: 'normal', numbers: true,
      titleSelector: 'h1, h2, h3',
      useTextContentForMissingTitles: true,
      hideMissingTitles: false, markers: true,
      themes: false, transitions: false,
      openButton: true, openSlideNumber: true,
      keyboard: true, sticky: true, autoOpen: true,
      loadIcons: false,
      custom: [{
        title: 'Tools',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        content: '<ul class="slide-menu-items">' +
          '<li class="slide-menu-item" data-action="fullscreen"><span class="km">f</span>Fullscreen</li>' +
          '<li class="slide-menu-item" data-action="speaker"><span class="km">s</span>Speaker View</li>' +
          '<li class="slide-menu-item" data-action="overview"><span class="km">o</span>Slide Overview</li>' +
          '<li class="slide-menu-item" data-action="pdf"><span class="km">e</span>PDF Export Mode</li>' +
          '<li class="slide-menu-item" data-action="scroll"><span class="km">r</span>Scroll View Mode</li>' +
          '<li class="slide-menu-item" data-action="help"><span class="km">?</span>Keyboard Help</li>' +
        '</ul>'
      }]
    },`)
  }

  if (presenterTools.chalkboard) {
    parts.push(`
    chalkboard: {
      boardmarkerWidth: 4, chalkWidth: 5, chalkEffect: 0.2,
      toggleChalkboardButton: false, toggleNotesButton: false,
      boardmarkers: [
        { color: 'rgba(0,0,0,1)', cursor: 'crosshair' },       /* Black */
        { color: 'rgba(100,100,100,1)', cursor: 'crosshair' }, /* Gray */
        { color: 'rgba(255,255,255,1)', cursor: 'crosshair' }, /* White */
        { color: 'rgba(220,20,60,1)', cursor: 'crosshair' },   /* Red */
        { color: 'rgba(50,205,50,1)', cursor: 'crosshair' },   /* Green */
        { color: 'rgba(30,144,255,1)', cursor: 'crosshair' },  /* Blue */
        { color: 'rgba(255,220,0,1)', cursor: 'crosshair' },   /* Yellow */
        { color: 'rgba(255,140,0,1)', cursor: 'crosshair' },   /* Orange */
        { color: 'rgba(150,0,150,1)', cursor: 'crosshair' },   /* Purple */
        { color: 'rgba(255,105,180,1)', cursor: 'crosshair' }  /* Pink */
      ],
      chalks: [
        { color: 'rgba(255,255,255,0.7)', cursor: 'crosshair' }, /* White */
        { color: 'rgba(200,200,200,0.7)', cursor: 'crosshair' }, /* Gray */
        { color: 'rgba(237,20,28,0.7)', cursor: 'crosshair' },   /* Red */
        { color: 'rgba(20,237,28,0.7)', cursor: 'crosshair' },   /* Green */
        { color: 'rgba(96,154,244,0.7)', cursor: 'crosshair' },  /* Blue */
        { color: 'rgba(255,220,0,0.7)', cursor: 'crosshair' },   /* Yellow */
        { color: 'rgba(220,133,41,0.7)', cursor: 'crosshair' },  /* Orange */
        { color: 'rgba(220,0,220,0.7)', cursor: 'crosshair' },   /* Purple */
        { color: 'rgba(255,182,193,0.7)', cursor: 'crosshair' }, /* Pink */
        { color: 'rgba(0,255,255,0.7)', cursor: 'crosshair' }    /* Cyan */
      ]
    },
    customcontrols: {
      controls: [
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
          title: 'Toggle notes canvas (C)',
          action: 'RevealChalkboard.toggleNotesCanvas();'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M2 17h20"/><path d="M6 21h12"/></svg>',
          title: 'Toggle chalkboard (B)',
          action: 'RevealChalkboard.toggleChalkboard();'
        }
      ]
    },`)
  }

  return parts.join('')
}

function getPresenterToolsBody(presenterTools) {
  if (!presenterTools) return ''
  const buttons = []

  if (presenterTools.themeToggle !== false) {
    buttons.push('<button id="theme-btn" onclick="toggleTheme()" title="Toggle dark/light">&#x1F313;</button>')
  }
  if (presenterTools.fontZoom !== false) {
    buttons.push('<button onclick="zoomFont(1)" title="Increase font">A+</button>')
    buttons.push('<button onclick="zoomFont(-1)" title="Decrease font">A\u2212</button>')
  }

  // Fullscreen button is always present
  buttons.push('<button id="fs-btn" title="Enter fullscreen (F)" onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()">&#x26F6;</button>')

  return `<div class="presenter-toolbar">${buttons.join('')}</div>`
}

function getPresenterToolsInlineJS(presenterTools) {
  if (!presenterTools) return ''
  const parts = []

  if (presenterTools.themeToggle !== false) {
    parts.push(`
    function toggleTheme() {
      var html = document.documentElement;
      var isLight = html.getAttribute('data-theme') === 'light';
      html.setAttribute('data-theme', isLight ? '' : 'light');
    }`)
  }

  if (presenterTools.fontZoom !== false) {
    parts.push(`
    var _fontZoomLevel = 0;
    var zoomFont = function(dir) {
      _fontZoomLevel = Math.max(-8, Math.min(8, _fontZoomLevel + dir));
      var scale = 1 - _fontZoomLevel * 0.05;
      var baseW = ${presenterTools._baseWidth || 960};
      var baseH = ${presenterTools._baseHeight || 540};
      Reveal.configure({
        width: Math.round(baseW * scale),
        height: Math.round(baseH * scale)
      });
      Reveal.layout();
    };`)
  }

  // Slide menu Tools panel: attach event delegation via addEventListener
  // (RevealMenu's C() overwrites .onclick on li.slide-menu-item, so we
  //  use addEventListener which is additive, not overwritten)
  if (presenterTools.slideMenu) {
    parts.push(`
    document.addEventListener('click', function(e) {
      var item = e.target.closest('[data-action]');
      if (!item) return;
      var action = item.getAttribute('data-action');
      switch (action) {
        case 'fullscreen':
          if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
          break;
        case 'speaker':
          var notesPlugin = Reveal.getPlugin('notes');
          if (notesPlugin && notesPlugin.open) notesPlugin.open();
          break;
        case 'overview':
          Reveal.toggleOverview();
          break;
        case 'pdf':
          window.open(location.href.split('?')[0] + '?print-pdf', '_blank');
          break;
        case 'scroll':
          Reveal.configure({ view: 'scroll' });
          break;
        case 'help':
          Reveal.toggleHelp();
          break;
      }
    });`)
  }

  return parts.length > 0 ? `\n  <script>${parts.join('')}\n  </script>` : ''
}

module.exports = {
  getPresenterToolsHead,
  getPresenterToolsScripts,
  getPresenterToolsPlugins,
  getPresenterToolsConfig,
  getPresenterToolsBody,
  getPresenterToolsInlineJS,
}
