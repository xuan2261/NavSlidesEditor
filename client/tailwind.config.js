/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  important: true,
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        workspace: 'var(--bg-workspace)',
        panel: 'var(--bg-panel)',
        'canvas-default': 'var(--bg-canvas-default)',
        card: 'var(--bg-card)',
        hover: 'var(--bg-hover)',
        active: 'var(--bg-active)',
        secondary: 'var(--bg-secondary)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          light: 'var(--color-primary-light)',
        },
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        border: {
          DEFAULT: 'var(--border)',
          light: 'var(--border-light)',
          strong: 'var(--border-strong)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          light: 'var(--accent-light)',
        },
        success: 'var(--success)',
        danger: {
          DEFAULT: 'var(--danger)',
          hover: 'var(--danger-hover)',
        },
        warning: 'var(--warning)',
      },
    },
  },
  plugins: [],
}
