const express = require('express')
const { z } = require('zod')
const { generateRevealHTML } = require('revealjs-shared')
const { readGithubConfig, writeGithubConfig, readPresentations } = require('../services/storage')
const { normalizePptxImportedPresentationForRead } = require('../services/presentation-normalization')
const { validate } = require('../middleware/validate')

const router = express.Router()

// GET /api/github/config
router.get('/config', async (req, res) => {
  try {
    const config = await readGithubConfig()
    res.json({
      owner: config.owner || '',
      repo: config.repo || '',
      hasToken: !!config.token,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const githubConfigSchema = z.object({
  token: z.string().max(500).optional(),
  owner: z.string().max(200).optional(),
  repo: z.string().max(200).optional(),
})

// POST /api/github/config
router.post('/config', validate(githubConfigSchema), async (req, res) => {
  try {
    const existing = await readGithubConfig()
    const updated = {
      token: req.body.token !== undefined ? req.body.token : existing.token,
      owner: req.body.owner !== undefined ? req.body.owner : existing.owner,
      repo: req.body.repo !== undefined ? req.body.repo : existing.repo,
    }
    await writeGithubConfig(updated)
    res.json({ owner: updated.owner, repo: updated.repo, hasToken: !!updated.token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const githubPushSchema = z.object({
  message: z.string().max(500).optional(),
})

// POST /api/presentations/:presId/github/push
router.post('/push/:presId', validate(githubPushSchema), async (req, res) => {
  try {
    const config = await readGithubConfig()
    if (!config.token || !config.owner || !config.repo) {
      return res
        .status(400)
        .json({ error: 'GitHub not configured. Set token, owner, and repo first.' })
    }

    const presentations = await readPresentations()
    const foundPresentation = presentations.find((p) => p.id === req.params.presId)
    if (!foundPresentation) return res.status(404).json({ error: 'Presentation not found' })
    const presentation = normalizePptxImportedPresentationForRead(foundPresentation)

    const { token, owner, repo } = config
    const gh = (endpoint, opts = {}) =>
      fetch(`https://api.github.com${endpoint}`, {
        ...opts,
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          ...opts.headers,
        },
      }).then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.message || `GitHub API ${r.status}`)
        return body
      })

    const folderName = (presentation.title || 'untitled')
      .replace(/[^a-z0-9_-]/gi, '_')
      .toLowerCase()
    const htmlContent = generateRevealHTML(presentation)
    const jsonContent = JSON.stringify(presentation, null, 2)

    // Get default branch
    const repoInfo = await gh(`/repos/${owner}/${repo}`)
    const branch = repoInfo.default_branch || 'main'

    // Check if repo has any commits
    let latestCommitSha = null
    let baseTreeSha = null
    try {
      const refData = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`)
      latestCommitSha = refData.object.sha
      const commitData = await gh(`/repos/${owner}/${repo}/git/commits/${latestCommitSha}`)
      baseTreeSha = commitData.tree.sha
    } catch {
      await gh(`/repos/${owner}/${repo}/contents/.gitkeep`, {
        method: 'PUT',
        body: JSON.stringify({ message: 'Initial commit', content: '' }),
      })
      const refData = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`)
      latestCommitSha = refData.object.sha
      const commitData = await gh(`/repos/${owner}/${repo}/git/commits/${latestCommitSha}`)
      baseTreeSha = commitData.tree.sha
    }

    // Discover existing folders
    const existingFolders = new Set()
    if (baseTreeSha) {
      const rootTree = await gh(`/repos/${owner}/${repo}/git/trees/${baseTreeSha}`)
      for (const item of rootTree.tree || []) {
        if (item.type === 'tree' && item.path !== '.github') existingFolders.add(item.path)
      }
    }
    existingFolders.add(folderName)

    // Build README
    const readmeLines = [`# Presentations\n`]
    for (const folder of [...existingFolders].sort()) {
      const displayName = folder.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      const viewUrl = `https://htmlpreview.github.io/?https://github.com/${owner}/${repo}/blob/${branch}/${encodeURIComponent(folder)}/presentation.html`
      readmeLines.push(`- [${displayName}](${viewUrl})`)
    }
    const readmeContent = readmeLines.join('\n') + '\n'

    // Create blobs
    const htmlBlob = await gh(`/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({
        content: Buffer.from(htmlContent).toString('base64'),
        encoding: 'base64',
      }),
    })
    const jsonBlob = await gh(`/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({
        content: Buffer.from(jsonContent).toString('base64'),
        encoding: 'base64',
      }),
    })
    const readmeBlob = await gh(`/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({
        content: Buffer.from(readmeContent).toString('base64'),
        encoding: 'base64',
      }),
    })

    // Create tree + commit
    const treePayload = {
      tree: [
        {
          path: `${folderName}/presentation.html`,
          mode: '100644',
          type: 'blob',
          sha: htmlBlob.sha,
        },
        {
          path: `${folderName}/presentation.json`,
          mode: '100644',
          type: 'blob',
          sha: jsonBlob.sha,
        },
        { path: 'README.md', mode: '100644', type: 'blob', sha: readmeBlob.sha },
      ],
    }
    if (baseTreeSha) treePayload.base_tree = baseTreeSha
    const newTree = await gh(`/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify(treePayload),
    })

    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const defaultMessage = `${presentation.title || 'Untitled'} [${dateStr} ${timeStr}]`
    const commitMessage = req.body && req.body.message ? req.body.message : defaultMessage

    const newCommit = await gh(`/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: commitMessage,
        tree: newTree.sha,
        parents: latestCommitSha ? [latestCommitSha] : [],
      }),
    })

    if (latestCommitSha) {
      await gh(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: newCommit.sha }),
      })
    } else {
      await gh(`/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: newCommit.sha }),
      })
    }

    res.json({
      success: true,
      commitSha: newCommit.sha,
      url: `https://github.com/${owner}/${repo}/tree/${branch}/${folderName}`,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
