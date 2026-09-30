import { defineProject } from 'vitest/config'
import {
  boundedWorkerCount,
  laneInclude,
  nodeSetupFiles,
} from './vitest-project-options.mjs'

export default defineProject({
  test: {
    name: 'node-parallel',
    include: laneInclude('node-parallel'),
    environment: 'node',
    globals: true,
    pool: 'forks',
    fileParallelism: true,
    maxWorkers: boundedWorkerCount,
    minWorkers: 1,
    setupFiles: nodeSetupFiles(),
  },
})
