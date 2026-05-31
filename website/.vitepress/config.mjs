import { defineConfig } from 'vitepress'

const base = process.env.VITEPRESS_BASE ?? '/NavSlidesEditor/'

// EN sidebar (root locale). VI mirrors this with a /vi/ prefix below.
const enSidebar = {
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
  '/develop/': [
    {
      text: 'Develop',
      items: [
        { text: 'Architecture', link: '/develop/architecture' },
        { text: 'Monorepo Structure', link: '/develop/monorepo-structure' },
        { text: 'Building from Source', link: '/develop/building-from-source' },
        { text: 'Contributing', link: '/develop/contributing' },
      ],
    },
  ],
}

const enNav = [
  { text: 'Guide', link: '/guide/getting-started' },
  { text: 'Features', link: '/features/overview' },
  { text: 'Tutorials', link: '/tutorials/first-presentation' },
  { text: 'Develop', link: '/develop/architecture' },
  { text: 'GitHub', link: 'https://github.com/xuan2261/NavSlidesEditor' },
]

// VI mirror — same structure, /vi/ prefixed paths, translated labels.
const viSidebar = {
  '/vi/guide/': [
    {
      text: 'Hướng dẫn',
      items: [
        { text: 'Bắt đầu', link: '/vi/guide/getting-started' },
        { text: 'Cài đặt', link: '/vi/guide/installation' },
        { text: 'Phím tắt', link: '/vi/guide/keyboard-shortcuts' },
      ],
    },
  ],
  '/vi/features/': [
    {
      text: 'Tính năng cốt lõi',
      items: [
        { text: 'Tổng quan', link: '/vi/features/overview' },
        { text: 'Định dạng văn bản', link: '/vi/features/text-formatting' },
        { text: 'Hình khối', link: '/vi/features/shapes' },
        { text: 'Biểu đồ', link: '/vi/features/charts' },
        { text: 'LaTeX', link: '/vi/features/latex' },
        { text: 'Xuất bản', link: '/vi/features/export' },
      ],
    },
    {
      text: 'Riêng NavSlides',
      items: [
        { text: 'Trình chiếu trực tiếp', link: '/vi/features/live-presentations' },
        { text: 'Chế độ trò chơi', link: '/vi/features/game-mode' },
        { text: 'Soạn thảo với AI', link: '/vi/features/ai-authoring' },
        { text: 'Nhập & xuất PPTX', link: '/vi/features/pptx-import-export' },
        { text: 'Đồng bộ đám mây', link: '/vi/features/cloud-sync' },
      ],
    },
  ],
  '/vi/tutorials/': [
    {
      text: 'Hướng dẫn thực hành',
      items: [
        { text: 'Bài trình chiếu đầu tiên', link: '/vi/tutorials/first-presentation' },
        { text: 'Văn bản & kiểu chữ', link: '/vi/tutorials/text-typography' },
        { text: 'Hình ảnh', link: '/vi/tutorials/images' },
        { text: 'Đa phương tiện', link: '/vi/tutorials/media' },
        { text: 'Hình khối & vẽ', link: '/vi/tutorials/shapes-drawing' },
        { text: 'Biểu đồ & bảng', link: '/vi/tutorials/charts-tables' },
        { text: 'Mã & công thức', link: '/vi/tutorials/code-math' },
        { text: 'Dùng LaTeX', link: '/vi/tutorials/using-latex' },
        { text: 'Hiệu ứng', link: '/vi/tutorials/animations' },
        { text: 'Chuyển cảnh', link: '/vi/tutorials/transitions' },
        { text: 'Văn bản động', link: '/vi/tutorials/kinetic-text' },
        { text: 'Nhúng HTML', link: '/vi/tutorials/html-embeds' },
        { text: 'Slide học thuật', link: '/vi/tutorials/academic-slides' },
        { text: 'Trình bày', link: '/vi/tutorials/presenting' },
      ],
    },
  ],
  '/vi/develop/': [
    {
      text: 'Phát triển',
      items: [
        { text: 'Kiến trúc', link: '/vi/develop/architecture' },
        { text: 'Cấu trúc monorepo', link: '/vi/develop/monorepo-structure' },
        { text: 'Build từ mã nguồn', link: '/vi/develop/building-from-source' },
        { text: 'Đóng góp', link: '/vi/develop/contributing' },
      ],
    },
  ],
}

const viNav = [
  { text: 'Hướng dẫn', link: '/vi/guide/getting-started' },
  { text: 'Tính năng', link: '/vi/features/overview' },
  { text: 'Thực hành', link: '/vi/tutorials/first-presentation' },
  { text: 'Phát triển', link: '/vi/develop/architecture' },
  { text: 'GitHub', link: 'https://github.com/xuan2261/NavSlidesEditor' },
]

export default defineConfig({
  // Shared, top-level options (must stay top-level for build + guard tests).
  base,
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,

  themeConfig: {
    siteTitle: 'NavSlides Editor',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/xuan2261/NavSlidesEditor' },
    ],
    footer: {
      message: 'Released under the AGPL-3.0 License.',
      copyright: 'Copyright © 2025-present NavSlides Editor contributors',
    },
    search: {
      provider: 'local',
      options: {
        locales: {
          vi: {
            translations: {
              button: { buttonText: 'Tìm kiếm', buttonAriaLabel: 'Tìm kiếm' },
              modal: {
                displayDetails: 'Hiển thị chi tiết',
                resetButtonTitle: 'Xóa tìm kiếm',
                backButtonTitle: 'Đóng tìm kiếm',
                noResultsText: 'Không có kết quả cho',
                footer: {
                  selectText: 'để chọn',
                  navigateText: 'để di chuyển',
                  closeText: 'để đóng',
                },
              },
            },
          },
        },
      },
    },
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'NavSlides Editor',
      description: 'Self-hostable WYSIWYG presentation editor powered by Reveal.js',
      head: [
        ['meta', { name: 'theme-color', content: '#0ea5e9' }],
        ['meta', { name: 'og:type', content: 'website' }],
        ['meta', { name: 'og:title', content: 'NavSlides Editor' }],
        ['meta', { name: 'og:description', content: 'Self-hostable WYSIWYG presentation editor powered by Reveal.js' }],
      ],
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
      },
    },
    vi: {
      label: 'Tiếng Việt',
      lang: 'vi-VN',
      link: '/vi/',
      title: 'NavSlides Editor',
      description: 'Trình soạn thảo trình chiếu WYSIWYG tự lưu trữ, chạy trên Reveal.js',
      head: [
        ['meta', { name: 'og:title', content: 'NavSlides Editor' }],
        ['meta', { name: 'og:description', content: 'Trình soạn thảo trình chiếu WYSIWYG tự lưu trữ, chạy trên Reveal.js' }],
      ],
      themeConfig: {
        nav: viNav,
        sidebar: viSidebar,
        docFooter: { prev: 'Trang trước', next: 'Trang sau' },
        darkModeSwitchLabel: 'Giao diện',
        lightModeSwitchTitle: 'Chuyển sang giao diện sáng',
        darkModeSwitchTitle: 'Chuyển sang giao diện tối',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Về đầu trang',
        langMenuLabel: 'Đổi ngôn ngữ',
        lastUpdatedText: 'Cập nhật lần cuối',
        outline: { label: 'Trên trang này' },
      },
    },
  },
})
