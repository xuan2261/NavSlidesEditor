import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const launcherRoot = path.join(process.cwd(), 'native', 'windows-officecli-launcher')

async function source(relativePath) {
  return fs.readFile(path.join(launcherRoot, relativePath), 'utf8')
}

describe('Windows OfficeCLI containment launcher source contract', () => {
  it('builds a static Win32 launcher with its containment implementation', async () => {
    await expect(source('CMakeLists.txt')).resolves.toContain('add_executable(officecli-containment-launcher')
    await expect(source('CMakeLists.txt')).resolves.toContain('MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>"')
  })

  it('requires job assignment before a target process resumes', async () => {
    const launch = await source('src/launch.cpp')
    const job = await source('src/job.cpp')
    expect(launch).toContain('CREATE_SUSPENDED')
    expect(launch).toContain('job.Assign(process.hProcess)')
    expect(job).toContain('AssignProcessToJobObject')
    expect(launch).toContain('ResumeThread')
    expect(launch.indexOf('job.Assign(process.hProcess)')).toBeLessThan(launch.indexOf('ResumeThread'))
  })

  it('uses a kill-on-close job and waits for the process tree to drain', async () => {
    const job = await source('src/job.cpp')
    expect(job).toContain('JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE')
    expect(job).toContain('JOB_OBJECT_MSG_ACTIVE_PROCESS_ZERO')
    expect(job).toContain('do {')
  })

  it('accepts only bounded validate requests and emits a terminal receipt', async () => {
    const protocol = await source('src/protocol.cpp')
    expect(protocol).toContain('L"\\"operation\\":\\"validate\\""')
    expect(protocol).toContain('L"{\\"kind\\":\\"officecli-containment-receipt-v1\\"')
    expect(protocol).toContain('kMaxRequestBytes')
    expect(protocol).toContain('MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS')
  })

  it('passes one-shot and no-update flags to the OfficeCLI target environment', async () => {
    const launch = await source('src/launch.cpp')
    expect(launch).toContain('OFFICECLI_NO_AUTO_RESIDENT=1')
    expect(launch).toContain('OFFICECLI_SKIP_UPDATE=1')
  })

  it('serializes receipt hashes with the qualification casing', async () => {
    const hasher = await source('src/sha256.cpp')
    expect(hasher).toContain('std::uppercase')
  })
})
