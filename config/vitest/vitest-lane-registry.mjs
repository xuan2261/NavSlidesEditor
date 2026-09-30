export const BROWSER_ENVIRONMENT_REGISTRY = [
  {
    id: 'shared-element-renderer-browser-origin',
    reason: 'reviewed shared renderer test depends on jsdom location/origin semantics',
    path:
      /^shared\/(?:src|tests)\/(?:element-renderers|htmlgenerator-golden-baseline)\.test\.js$/,
  },
  {
    id: 'shared-presentation-window-launch',
    reason: 'reviewed shared presentation test exercises window, Blob, and object URLs',
    path: /^shared\/tests\/presentation-start-position\.test\.js$/,
  },
]

export const SERIAL_HAZARD_REGISTRY = [
  {
    id: 'reviewed-stateful-path',
    reason: 'reviewed stateful storage, lock, socket, room, or process lifecycle test',
    path:
      /(?:^|\/)[^/]*(?:storage|writer-lock|package-lock|runtime-lock|concurrency|race|socket|live-room|room-manager|crash-points|compensation)[^/]*\.(?:test|spec)\.[cm]?[jt]sx?$/,
  },
]

export const SERIAL_HAZARD_EXEMPTIONS = Object.freeze({
  'scripts/vitest/baseline-support.test.mjs': {
    hazards: ['child-process'],
    reason: 'uses isolated temporary Git repositories and synchronous child processes',
  },
  'tests/unit/vitest-topology-contract.test.js': {
    hazards: ['child-process'],
    reason: 'contains a scanner fixture string and does not spawn a process',
  },
})
