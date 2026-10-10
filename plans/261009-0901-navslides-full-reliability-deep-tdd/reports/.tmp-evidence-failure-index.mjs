import { readFile } from 'node:fs/promises'
const report = JSON.parse(await readFile(process.argv[2], 'utf8'))
const failures = (report.testResults || []).flatMap((file) => {
  const tests = (file.assertionResults || []).filter((test) => test.status === 'failed')
  return tests.map((test) => ({ file: file.name, title: test.fullName, failures: test.failureMessages }))
})
console.log(JSON.stringify({ success: report.success, passed: report.numPassedTests,
  failed: report.numFailedTests, pending: report.numPendingTests, failures }, null, 2))
