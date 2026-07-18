import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import clientModule from './launcher-client.js'

const { createNativeLauncherClient } = clientModule
const roots = []
const INPUT_BYTES = Buffer.from('input-package')
const INPUT_SHA256 = crypto.createHash('sha256').update(INPUT_BYTES).digest('hex').toUpperCase()

function receipt({ executionCopy, binaryVersion, policyDigest, inputSha256 = INPUT_SHA256, verdict = 'qualified', exitCode = verdict === 'qualified' ? 0 : 7 }) {
  return {
    kind: 'officecli-containment-receipt-v1',
    verdict,
    operation: 'validate',
    executionCopy,
    launcher: { sha256: 'launcher-sha', version: '1.0.0' },
    binary: { sha256: executionCopy.sha256, version: binaryVersion },
    inputSha256,
    policyDigest,
    exitCode,
  }
}

function qualification({ executionCopy, binaryVersion, policyDigest = 'policy-sha' }) {
  return {
    available: true,
    candidate: { version: binaryVersion, identity: { sha256: executionCopy.sha256, size: executionCopy.byteLength } },
    executionCopy,
    containmentReceipt: receipt({ executionCopy, binaryVersion, policyDigest }),
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('native OfficeCLI launcher client', () => {
  it('sends a bounded validate request only to the launcher', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-native-client-'))
    roots.push(workspace)
    const executionCopy = { canonicalPath: 'C:\\private\\officecli.exe', sha256: 'binary-sha', byteLength: 12 }
    await fs.writeFile(path.join(workspace, 'input.pptx'), INPUT_BYTES)
    const policyDigest = 'policy-sha'
    const runProcess = vi.fn(async ({ binary, argv, cwd }) => {
      expect(binary).toBe('C:\\private\\officecli-containment-launcher.exe')
      expect(argv).toHaveLength(2)
      expect(argv[0]).toBe('--request')
      expect(cwd).toBe(workspace)
      const request = JSON.parse(await fs.readFile(argv[1], 'utf8'))
      expect(request).toMatchObject({ operation: 'validate', binaryVersion: '1.0.135', executionCopy: executionCopy.canonicalPath })
      return { exitCode: 0, stdout: JSON.stringify(receipt({ executionCopy, binaryVersion: '1.0.135', policyDigest })), stderr: '' }
    })
    const client = createNativeLauncherClient({
      launcherPath: 'C:\\private\\officecli-containment-launcher.exe',
      launcherIdentity: { sha256: 'launcher-sha', version: '1.0.0' },
      policyDigest,
      verifyLauncher: async () => true,
      runProcess,
    })

    await expect(client.run({
      operation: 'validate',
      qualification: qualification({ executionCopy, binaryVersion: '1.0.135' }),
      workspace: { path: workspace },
      inputPath: path.join(workspace, 'input.pptx'),
    })).resolves.toMatchObject({ exitCode: 0 })
    expect(runProcess).toHaveBeenCalledOnce()
  })

  it('rejects candidate identity without a containment receipt before process launch', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-native-client-'))
    roots.push(workspace)
    const executionCopy = { canonicalPath: 'C:\\private\\officecli.exe', sha256: 'binary-sha', byteLength: 12 }
    const runProcess = vi.fn()
    const client = createNativeLauncherClient({
      launcherPath: 'C:\\private\\officecli-containment-launcher.exe',
      launcherIdentity: { sha256: 'launcher-sha', version: '1.0.0' },
      policyDigest: 'policy-sha',
      verifyLauncher: async () => true,
      runProcess,
    })
    const candidateOnly = qualification({ executionCopy, binaryVersion: '1.0.135' })
    delete candidateOnly.containmentReceipt

    await expect(client.run({
      operation: 'validate',
      qualification: candidateOnly,
      workspace: { path: workspace },
      inputPath: path.join(workspace, 'input.pptx'),
    })).rejects.toMatchObject({ code: 'QUALIFICATION_RECEIPT_REQUIRED' })
    expect(runProcess).not.toHaveBeenCalled()
  })

  it('rejects a containment receipt from a different policy before process launch', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-native-client-'))
    roots.push(workspace)
    const executionCopy = { canonicalPath: 'C:\\private\\officecli.exe', sha256: 'binary-sha', byteLength: 12 }
    const runProcess = vi.fn()
    const client = createNativeLauncherClient({
      launcherPath: 'C:\\private\\officecli-containment-launcher.exe',
      launcherIdentity: { sha256: 'launcher-sha', version: '1.0.0' },
      policyDigest: 'policy-sha',
      verifyLauncher: async () => true,
      runProcess,
    })

    await expect(client.run({
      operation: 'validate',
      qualification: qualification({ executionCopy, binaryVersion: '1.0.135', policyDigest: 'other-policy' }),
      workspace: { path: workspace },
      inputPath: path.join(workspace, 'input.pptx'),
    })).rejects.toMatchObject({ code: 'POLICY_DIGEST_MISMATCH' })
    expect(runProcess).not.toHaveBeenCalled()
  })

  it('rejects a malformed receipt before it reaches the gateway', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-native-client-'))
    roots.push(workspace)
    const executionCopy = { canonicalPath: 'C:\\private\\officecli.exe', sha256: 'binary-sha', byteLength: 12 }
    await fs.writeFile(path.join(workspace, 'input.pptx'), INPUT_BYTES)
    const client = createNativeLauncherClient({
      launcherPath: 'C:\\private\\officecli-containment-launcher.exe',
      launcherIdentity: { sha256: 'launcher-sha', version: '1.0.0' },
      policyDigest: 'policy-sha',
      verifyLauncher: async () => true,
      runProcess: async () => ({ exitCode: 0, stdout: '{"kind":"wrong"}', stderr: '' }),
    })

    await expect(client.run({
      operation: 'validate',
      qualification: qualification({ executionCopy, binaryVersion: '1.0.135' }),
      workspace: { path: workspace },
      inputPath: path.join(workspace, 'input.pptx'),
    })).rejects.toMatchObject({ code: 'LAUNCHER_RECEIPT_INVALID' })
  })

  it('maps malformed launcher JSON to a typed receipt error', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-native-client-'))
    roots.push(workspace)
    const executionCopy = { canonicalPath: 'C:\\private\\officecli.exe', sha256: 'binary-sha', byteLength: 12 }
    await fs.writeFile(path.join(workspace, 'input.pptx'), INPUT_BYTES)
    const client = createNativeLauncherClient({
      launcherPath: 'C:\\private\\officecli-containment-launcher.exe',
      launcherIdentity: { sha256: 'launcher-sha', version: '1.0.0' },
      policyDigest: 'policy-sha',
      verifyLauncher: async () => true,
      runProcess: async () => ({ exitCode: 0, stdout: '{malformed', stderr: '' }),
    })

    await expect(client.run({
      operation: 'validate',
      qualification: qualification({ executionCopy, binaryVersion: '1.0.135' }),
      workspace: { path: workspace },
      inputPath: path.join(workspace, 'input.pptx'),
    })).rejects.toMatchObject({ code: 'LAUNCHER_RECEIPT_INVALID' })
  })

  it('preserves a typed failed terminal receipt for gateway status handling', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-native-client-'))
    roots.push(workspace)
    const executionCopy = { canonicalPath: 'C:\\private\\officecli.exe', sha256: 'binary-sha', byteLength: 12 }
    await fs.writeFile(path.join(workspace, 'input.pptx'), INPUT_BYTES)
    const client = createNativeLauncherClient({
      launcherPath: 'C:\\private\\officecli-containment-launcher.exe',
      launcherIdentity: { sha256: 'launcher-sha', version: '1.0.0' },
      policyDigest: 'policy-sha',
      verifyLauncher: async () => true,
      runProcess: async () => ({
        exitCode: 7,
        stdout: JSON.stringify(receipt({ executionCopy, binaryVersion: '1.0.135', policyDigest: 'policy-sha', verdict: 'failed' })),
        stderr: '',
      }),
    })

    await expect(client.run({
      operation: 'validate',
      qualification: qualification({ executionCopy, binaryVersion: '1.0.135' }),
      workspace: { path: workspace },
      inputPath: path.join(workspace, 'input.pptx'),
    })).resolves.toMatchObject({ exitCode: 7, receipt: { verdict: 'failed' } })
  })

  it('accepts target failure receipts when the launcher uses a generic failure exit code', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-native-client-'))
    roots.push(workspace)
    const executionCopy = { canonicalPath: 'C:\\private\\officecli.exe', sha256: 'binary-sha', byteLength: 12 }
    await fs.writeFile(path.join(workspace, 'input.pptx'), INPUT_BYTES)
    const client = createNativeLauncherClient({
      launcherPath: 'C:\\private\\officecli-containment-launcher.exe',
      launcherIdentity: { sha256: 'launcher-sha', version: '1.0.0' },
      policyDigest: 'policy-sha',
      verifyLauncher: async () => true,
      runProcess: async () => ({
        exitCode: 1067,
        stdout: JSON.stringify(receipt({ executionCopy, binaryVersion: '1.0.135', policyDigest: 'policy-sha', verdict: 'failed', exitCode: 7 })),
        stderr: '',
      }),
    })

    await expect(client.run({
      operation: 'validate',
      qualification: qualification({ executionCopy, binaryVersion: '1.0.135' }),
      workspace: { path: workspace },
      inputPath: path.join(workspace, 'input.pptx'),
    })).resolves.toMatchObject({ exitCode: 1067, receipt: { verdict: 'failed', exitCode: 7 } })
  })

  it('rejects a failed receipt with a successful process exit code', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-native-client-'))
    roots.push(workspace)
    const executionCopy = { canonicalPath: 'C:\\private\\officecli.exe', sha256: 'binary-sha', byteLength: 12 }
    await fs.writeFile(path.join(workspace, 'input.pptx'), INPUT_BYTES)
    const client = createNativeLauncherClient({
      launcherPath: 'C:\\private\\officecli-containment-launcher.exe',
      launcherIdentity: { sha256: 'launcher-sha', version: '1.0.0' },
      policyDigest: 'policy-sha',
      verifyLauncher: async () => true,
      runProcess: async () => ({
        exitCode: 0,
        stdout: JSON.stringify(receipt({ executionCopy, binaryVersion: '1.0.135', policyDigest: 'policy-sha', verdict: 'failed', exitCode: 0 })),
        stderr: '',
      }),
    })

    await expect(client.run({
      operation: 'validate',
      qualification: qualification({ executionCopy, binaryVersion: '1.0.135' }),
      workspace: { path: workspace },
      inputPath: path.join(workspace, 'input.pptx'),
    })).rejects.toMatchObject({ code: 'LAUNCHER_RECEIPT_INVALID' })
  })

  it('rejects a receipt bound to different input bytes', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-native-client-'))
    roots.push(workspace)
    const executionCopy = { canonicalPath: 'C:\\private\\officecli.exe', sha256: 'binary-sha', byteLength: 12 }
    await fs.writeFile(path.join(workspace, 'input.pptx'), INPUT_BYTES)
    const client = createNativeLauncherClient({
      launcherPath: 'C:\\private\\officecli-containment-launcher.exe',
      launcherIdentity: { sha256: 'launcher-sha', version: '1.0.0' },
      policyDigest: 'policy-sha',
      verifyLauncher: async () => true,
      runProcess: async () => ({
        exitCode: 0,
        stdout: JSON.stringify(receipt({ executionCopy, binaryVersion: '1.0.135', policyDigest: 'policy-sha', inputSha256: '0'.repeat(64) })),
        stderr: '',
      }),
    })

    await expect(client.run({
      operation: 'validate',
      qualification: qualification({ executionCopy, binaryVersion: '1.0.135' }),
      workspace: { path: workspace },
      inputPath: path.join(workspace, 'input.pptx'),
    })).rejects.toMatchObject({ code: 'LAUNCHER_RECEIPT_INVALID' })
  })

  it('reverifies the pinned launcher before it creates a process', async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-native-client-'))
    roots.push(workspace)
    const executionCopy = { canonicalPath: 'C:\\private\\officecli.exe', sha256: 'binary-sha', byteLength: 12 }
    const runProcess = vi.fn()
    const client = createNativeLauncherClient({
      launcherPath: 'C:\\private\\officecli-containment-launcher.exe',
      launcherIdentity: { sha256: 'launcher-sha', version: '1.0.0' },
      policyDigest: 'policy-sha',
      verifyLauncher: async () => false,
      runProcess,
    })

    await expect(client.run({
      operation: 'validate',
      qualification: qualification({ executionCopy, binaryVersion: '1.0.135' }),
      workspace: { path: workspace },
      inputPath: path.join(workspace, 'input.pptx'),
    })).rejects.toMatchObject({ code: 'LAUNCHER_IDENTITY_CHANGED' })
    expect(runProcess).not.toHaveBeenCalled()
  })
})
