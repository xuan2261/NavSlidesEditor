import js from '@eslint/js'
import globals from 'globals'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import unusedImports from 'eslint-plugin-unused-imports'

export default [
  js.configs.recommended,
  {
    ignores: [
      'client/dist/**',
      'dist-electron/**',
      'node_modules/**',
      'server/node_modules/**',
      'server/vendor/**',
      'plans/**',
      'docs/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },
  // Root-level tool configs
  {
    files: ['*.config.js', 'playwright.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'commonjs',
    },
  },
  {
    files: ['*.config.mjs', 'client/vite.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
    },
  },
  // Global rule overrides — downgrade common style issues to warnings
  {
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-undef': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'no-prototype-builtins': 'warn',
      'no-fallthrough': 'warn',
      'no-cond-assign': 'warn',
      'no-redeclare': 'warn',
      'no-control-regex': 'warn',
      'no-case-declarations': 'warn',
      'no-constant-condition': 'warn',
      'no-extra-boolean-cast': 'warn',
      'no-misleading-character-class': 'warn',
      'no-regex-spaces': 'warn',
      'no-self-assign': 'warn',
      'no-empty-pattern': 'warn',
    },
  },
  // Client (React)
  {
    files: ['client/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
  // Server
  {
    files: ['server/**/*.js'],
    ignores: ['server/**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'commonjs',
    },
  },
  // Server + Shared test files (use ES modules)
  {
    files: ['server/**/*.test.js', 'shared/**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
    },
  },
  // Shared
  {
    files: ['shared/**/*.js'],
    ignores: ['shared/**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      sourceType: 'commonjs',
    },
  },
  // Scripts
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      sourceType: 'module',
    },
  },
  // Electron
  {
    files: ['electron/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'commonjs',
    },
  },
  // E2E + Unit tests
  {
    files: ['tests/**/*.js', 'tests/**/*.spec.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      sourceType: 'module',
    },
    rules: {
      'no-empty': 'off',
    },
  },
]
