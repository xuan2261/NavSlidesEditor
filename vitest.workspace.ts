import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'client',
  'server',
  'shared',
  {
    test: {
      name: 'scripts',
      include: ['scripts/**/*.test.js'],
      environment: 'node',
      globals: true,
    },
  },
])
