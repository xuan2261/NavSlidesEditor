/* global __ENV */
/**
 * Shared k6 profile options for NavSlides Editor load tests.
 * Profiles are selected via env: PROFILE=smoke|load|stress (default: smoke).
 *
 * - smoke   : 1 VU × 30s   (CI-friendly sanity check, exits < 1 min)
 * - load    : 20 VU × 5min (sustained typical traffic)
 * - stress  : 100 VU × 2min (peak / stress run, CI runner only)
 */

export const PROFILES = {
  smoke: { vus: 1, duration: '30s' },
  load: { vus: 20, duration: '5m' },
  stress: { vus: 100, duration: '2m' },
}

export function getProfileName() {
  const raw = (__ENV.PROFILE || 'smoke').toLowerCase()
  if (!PROFILES[raw]) {
    throw new Error(
      `Unknown PROFILE='${raw}'. Expected one of: smoke|load|stress.`
    )
  }
  return raw
}

export function getProfile() {
  const name = getProfileName()
  return { name, ...PROFILES[name] }
}

export function buildOptions(thresholds) {
  const p = getProfile()
  return {
    vus: p.vus,
    duration: p.duration,
    thresholds,
    tags: { profile: p.name },
  }
}
