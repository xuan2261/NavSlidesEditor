import { defineProject } from 'vitest/config'
import {
  boundedWorkerCount,
  laneInclude,
  pointerSetup,
  storageSetup,
} from './vitest-project-options.mjs'

export default defineProject({
  test: {
    name: 'client-jsdom',
    include: laneInclude('client-jsdom'),
    environment: 'jsdom',
    globals: true,
    fileParallelism: true,
    maxWorkers: boundedWorkerCount,
    minWorkers: 1,
    setupFiles: [storageSetup, pointerSetup],
  },
})
