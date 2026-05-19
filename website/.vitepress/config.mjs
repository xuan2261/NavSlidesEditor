import { defineConfig } from 'vitepress'

const base = process.env.VITEPRESS_BASE ?? '/NavSlidesEditor/'

export default defineConfig({
  base,
  lang: 'en-US',
  title: 'NavSlides Editor',
  description: 'Self-hostable WYSIWYG presentation editor powered by Reveal.js',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  head: [
    ['meta', { name: 'theme-color', content: '#0ea5e9' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: 'NavSlides Editor' }],
    ['meta', { name: 'og:description', content: 'Self-hostable WYSIWYG presentation editor powered by Reveal.js' }],
  ],
  themeConfig: {
    siteTitle: 'NavSlides Editor',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Features', link: '/features/overview' },
      { text: 'Tutorials', link: '/tutorials/first-presentation' },
      { text: 'GitHub', link: 'https://github.com/xuan2261/NavSlidesEditor' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Keyboard Shortcuts', link: '/guide/keyboard-shortcuts' },
          ],
        },
      ],
      '/features/': [
        {
          text: 'Core',
          items: [
            { text: 'Overview', link: '/features/overview' },
            { text: 'Text Formatting', link: '/features/text-formatting' },
            { text: 'Shapes', link: '/features/shapes' },
            { text: 'Charts', link: '/features/charts' },
            { text: 'LaTeX', link: '/features/latex' },
            { text: 'Export', link: '/features/export' },
          ],
        },
        {
          text: 'NavSlides-only',
          items: [
            { text: 'Live Presentations', link: '/features/live-presentations' },
            { text: 'Game Mode', link: '/features/game-mode' },
            { text: 'AI Authoring', link: '/features/ai-authoring' },
            { text: 'PPTX Import & Export', link: '/features/pptx-import-export' },
            { text: 'Cloud Sync', link: '/features/cloud-sync' },
          ],
        },
      ],
      '/tutorials/': [
        {
          text: 'Tutorials',
          items: [
            { text: 'First Presentation', link: '/tutorials/first-presentation' },
            { text: 'Text & Typography', link: '/tutorials/text-typography' },
            { text: 'Images', link: '/tutorials/images' },
            { text: 'Media', link: '/tutorials/media' },
            { text: 'Shapes & Drawing', link: '/tutorials/shapes-drawing' },
            { text: 'Charts & Tables', link: '/tutorials/charts-tables' },
            { text: 'Code & Math', link: '/tutorials/code-math' },
            { text: 'Using LaTeX', link: '/tutorials/using-latex' },
            { text: 'Animations', link: '/tutorials/animations' },
            { text: 'Transitions', link: '/tutorials/transitions' },
            { text: 'Kinetic Text', link: '/tutorials/kinetic-text' },
            { text: 'HTML Embeds', link: '/tutorials/html-embeds' },
            { text: 'Academic Slides', link: '/tutorials/academic-slides' },
            { text: 'Presenting', link: '/tutorials/presenting' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/xuan2261/NavSlidesEditor' },
    ],
    footer: {
      message: 'Released under the AGPL-3.0 License.',
      copyright: 'Copyright © 2025-present NavSlides Editor contributors',
    },
    search: { provider: 'local' },
  },
})
