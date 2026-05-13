/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  important: '#root',
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
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
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          muted: 'var(--brand-muted)',
        },
        focus: 'var(--focus)',
        selection: {
          DEFAULT: 'var(--selection)',
          muted: 'var(--selection-muted)',
        },
        success: 'var(--success)',
        danger: {
          DEFAULT: 'var(--danger)',
          hover: 'var(--danger-hover)',
        },
        warning: 'var(--warning)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        zoomIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'zoom-in': 'zoomIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
