import { defineProject } from 'vitest/config'
import { laneInclude, nodeSetupFiles } from './vitest-project-options.mjs'

export default defineProject({
  test: {
    name: 'node-serial',
    include: laneInclude('node-serial'),
    environment: 'node',
    globals: true,
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    setupFiles: nodeSetupFiles(),
  },
})
