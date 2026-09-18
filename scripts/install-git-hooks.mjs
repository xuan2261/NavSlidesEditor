// Installs git hooks via husky on dev machines. Skips when running inside a
// production-only install (npm ci --omit=dev executes prepare but devDeps are
// absent) and when HUSKY=0.
if (process.env.NODE_ENV === 'production' || process.env.HUSKY === '0') {
  process.exit(0)
}
try {
  const { default: install } = await import('husky')
  install()
} catch {
  // husky not installed (e.g. --omit=dev) — nothing to do
}
