const mode = process.argv[2]

if (mode === 'hang') {
  setInterval(() => {}, 1000)
} else if (mode === 'flood') {
  process.stdout.write('x'.repeat(256 * 1024))
} else if (mode === 'stderr-secret') {
  process.stderr.write('token=top-secret C:\\Users\\person\\private.pptx')
  process.exitCode = 2
} else if (mode === 'malformed') {
  process.stdout.write('noise before json')
} else {
  process.stdout.write(JSON.stringify({ ok: true, argv: process.argv.slice(3) }))
}
