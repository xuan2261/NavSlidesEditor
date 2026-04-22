const fs = require('fs-extra')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

const DATA_PATH = path.join(__dirname, '..', 'data', 'built-in-templates.json')

// Base slides for 5-7 slides structure
const generateSlides = (themeColor, bgType, bgValue, titleColor, textColor) => {
  const bg =
    bgType === 'color' ? { type: 'color', color: bgValue } : { type: 'gradient', gradient: bgValue }
  return [
    {
      // Slide 1: Title
      id: uuidv4(),
      elements: [
        {
          type: 'text',
          x: 80,
          y: 180,
          width: 800,
          height: 100,
          zIndex: 1,
          content: `<h1 style="text-align:center; color:${titleColor}">Presentation Title</h1>`,
        },
        {
          type: 'text',
          x: 200,
          y: 300,
          width: 560,
          height: 60,
          zIndex: 2,
          content: `<p style="text-align:center; color:${textColor}">Subtitle &middot; Date</p>`,
        },
      ],
      background: bg,
    },
    {
      // Slide 2: TOC
      id: uuidv4(),
      elements: [
        {
          type: 'text',
          x: 60,
          y: 40,
          width: 840,
          height: 70,
          zIndex: 1,
          content: `<h2 style="color:${titleColor}">Agenda</h2>`,
        },
        {
          type: 'shape',
          shape: 'rect',
          x: 60,
          y: 110,
          width: 840,
          height: 2,
          zIndex: 2,
          fill: themeColor,
          stroke: 'none',
          strokeWidth: 0,
          locked: true,
        },
        {
          type: 'text',
          x: 60,
          y: 140,
          width: 840,
          height: 360,
          zIndex: 3,
          content: `<ul style="color:${textColor}; font-size:24px; line-height:2"><li>Introduction</li><li>Core Concepts</li><li>Data Analysis</li><li>Case Studies</li><li>Conclusion</li></ul>`,
        },
      ],
      background: bg,
    },
    {
      // Slide 3: Content
      id: uuidv4(),
      elements: [
        {
          type: 'text',
          x: 60,
          y: 40,
          width: 840,
          height: 70,
          zIndex: 1,
          content: `<h2 style="color:${titleColor}">Core Concept</h2>`,
        },
        {
          type: 'shape',
          shape: 'rect',
          x: 60,
          y: 110,
          width: 840,
          height: 2,
          zIndex: 2,
          fill: themeColor,
          stroke: 'none',
          strokeWidth: 0,
          locked: true,
        },
        {
          type: 'text',
          x: 60,
          y: 140,
          width: 400,
          height: 360,
          zIndex: 3,
          content: `<p style="color:${textColor}">This is the left column. Replace this with your insightful content to engage the audience.</p>`,
        },
        {
          type: 'text',
          x: 500,
          y: 140,
          width: 400,
          height: 360,
          zIndex: 4,
          content: `<p style="color:${textColor}">This is the right column. Use bullet points or short paragraphs for readability.</p>`,
        },
      ],
      background: bg,
    },
    {
      // Slide 4: Data / Chart
      id: uuidv4(),
      elements: [
        {
          type: 'text',
          x: 60,
          y: 40,
          width: 840,
          height: 70,
          zIndex: 1,
          content: `<h2 style="color:${titleColor}">Data Insights</h2>`,
        },
        {
          type: 'shape',
          shape: 'rect',
          x: 60,
          y: 110,
          width: 840,
          height: 2,
          zIndex: 2,
          fill: themeColor,
          stroke: 'none',
          strokeWidth: 0,
          locked: true,
        },
        {
          type: 'chart',
          chartType: 'bar',
          x: 100,
          y: 150,
          width: 760,
          height: 400,
          zIndex: 3,
          data: {
            labels: ['Q1', 'Q2', 'Q3', 'Q4'],
            datasets: [
              { label: 'Revenue', data: [120, 190, 300, 500], backgroundColor: themeColor },
            ],
          },
        },
      ],
      background: bg,
    },
    {
      // Slide 5: Ending
      id: uuidv4(),
      elements: [
        {
          type: 'text',
          x: 80,
          y: 200,
          width: 800,
          height: 100,
          zIndex: 1,
          content: `<h1 style="text-align:center; color:${titleColor}">Thank You</h1>`,
        },
        {
          type: 'text',
          x: 200,
          y: 300,
          width: 560,
          height: 60,
          zIndex: 2,
          content: `<p style="text-align:center; color:${textColor}">Q&A Session</p>`,
        },
      ],
      background: bg,
    },
  ]
}

const NEW_TEMPLATES = [
  {
    id: 'deck-blank-light',
    category: 'minimal',
    title: 'Blank Light',
    description: 'Clean minimal light theme',
    tags: ['light', 'minimal', 'clean'],
    theme: 'white',
    transition: 'slide',
    thumbnail: { type: 'color', color: '#ffffff' },
    slides: generateSlides('#3b82f6', 'color', '#ffffff', '#1a1a2e', '#333333'),
  },

  {
    id: 'deck-blank-dark',
    category: 'minimal',
    title: 'Blank Dark',
    description: 'Clean minimal dark theme',
    tags: ['dark', 'minimal', 'clean'],
    theme: 'black',
    transition: 'fade',
    thumbnail: { type: 'color', color: '#111111' },
    slides: generateSlides('#6366f1', 'color', '#111111', '#ffffff', 'rgba(255,255,255,0.8)'),
  },

  {
    id: 'deck-palette',
    category: 'creative',
    title: 'Palette',
    description: 'Vibrant and creative colors',
    tags: ['creative', 'colors', 'vibrant'],
    theme: 'solarized',
    transition: 'zoom',
    thumbnail: { type: 'color', color: '#fdf6e3' },
    slides: generateSlides('#cb4b16', 'color', '#fdf6e3', '#073642', '#586e75'),
  },

  {
    id: 'deck-bento',
    category: 'creative',
    title: 'Bento',
    description: 'Grid-based bento box design',
    tags: ['bento', 'grid', 'modern'],
    theme: 'white',
    transition: 'convex',
    thumbnail: { type: 'gradient', gradient: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)' },
    slides: generateSlides(
      '#10b981',
      'gradient',
      'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
      '#1f2937',
      '#4b5563'
    ),
  },

  {
    id: 'deck-serif',
    category: 'academic',
    title: 'Serif',
    description: 'Classic typography for reading',
    tags: ['serif', 'academic', 'classic'],
    theme: 'serif',
    transition: 'slide',
    thumbnail: { type: 'color', color: '#fcfcfc' },
    slides: generateSlides('#991b1b', 'color', '#fcfcfc', '#171717', '#404040'),
  },

  {
    id: 'deck-bold',
    category: 'corporate',
    title: 'Bold',
    description: 'High contrast for impact',
    tags: ['bold', 'contrast', 'impact'],
    theme: 'blood',
    transition: 'none',
    thumbnail: { type: 'color', color: '#222222' },
    slides: generateSlides('#e53e3e', 'color', '#222222', '#ffffff', '#e2e8f0'),
  },

  {
    id: 'deck-minimal',
    category: 'minimal',
    title: 'Minimalist',
    description: 'Focus entirely on content',
    tags: ['minimalist', 'focus', 'simple'],
    theme: 'simple',
    transition: 'fade',
    thumbnail: { type: 'color', color: '#fafafa' },
    slides: generateSlides('#000000', 'color', '#fafafa', '#000000', '#222222'),
  },

  {
    id: 'deck-code',
    category: 'engineering',
    title: 'Code',
    description: 'Developer focused template',
    tags: ['code', 'developer', 'dark'],
    theme: 'night',
    transition: 'slide',
    thumbnail: { type: 'color', color: '#1a1b26' },
    slides: generateSlides('#7aa2f7', 'color', '#1a1b26', '#c0caf5', '#9aa5ce'),
  },

  {
    id: 'deck-desk',
    category: 'corporate',
    title: 'Desk',
    description: 'Professional office environment',
    tags: ['office', 'professional', 'corporate'],
    theme: 'league',
    transition: 'slide',
    thumbnail: { type: 'color', color: '#2b2b2b' },
    slides: generateSlides('#13daec', 'color', '#2b2b2b', '#eeeeee', '#cccccc'),
  },

  {
    id: 'deck-ellipse',
    category: 'creative',
    title: 'Ellipse',
    description: 'Soft rounded shapes',
    tags: ['ellipse', 'soft', 'modern'],
    theme: 'sky',
    transition: 'concave',
    thumbnail: { type: 'gradient', gradient: 'radial-gradient(circle, #f6f8fd, #e9eff9)' },
    slides: generateSlides(
      '#3b82f6',
      'gradient',
      'radial-gradient(circle, #f6f8fd, #e9eff9)',
      '#333333',
      '#555555'
    ),
  },
]

async function run() {
  try {
    let existing = []
    if (await fs.pathExists(DATA_PATH)) {
      existing = await fs.readJson(DATA_PATH)
    }

    // Check if new templates already exist to avoid duplicates
    const newIds = NEW_TEMPLATES.map((t) => t.id)
    existing = existing.filter((t) => !newIds.includes(t.id))

    const combined = [...existing, ...NEW_TEMPLATES]

    await fs.writeJson(DATA_PATH, combined, { spaces: 2 })
    console.log(`Successfully added ${NEW_TEMPLATES.length} full-deck templates.`)
  } catch (err) {
    console.error('Failed to generate templates:', err)
  }
}

run()
