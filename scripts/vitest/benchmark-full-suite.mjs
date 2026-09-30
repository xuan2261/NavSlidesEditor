import { parseArgs } from 'node:util'
import { runBaselineBenchmark } from './benchmark-baseline.mjs'
import { runOptimizedBenchmark } from './benchmark-optimized.mjs'

const { values } = parseArgs({
  options: {
    mode: { type: 'string' },
    config: { type: 'string' },
    runs: { type: 'string' },
    inventory: { type: 'string' },
    attempt: { type: 'string' },
    budget: { type: 'string' },
    baseline: { type: 'string' },
    out: { type: 'string' },
  },
})

if (values.mode === 'baseline') await runBaselineBenchmark(values)
else if (values.mode === 'optimized' || values.mode === 'ci-budget') {
  await runOptimizedBenchmark(values)
} else {
  throw new Error('--mode must be baseline, optimized, or ci-budget')
}
