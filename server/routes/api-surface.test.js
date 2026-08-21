import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs-extra'
import path from 'path'
import * as storage from '../services/storage.js'
import githubRouter from './github.js'
import syncRouter from './sync.js'
import uploadRouter from './upload.js'
import historyRouter from './history.js'
import settingsRouter from './settings.js'
import mediaRouter from './media.js'
import liveRouter from './live.js'
import analyticsRouter, { recordView } from './analytics.js'
import exploreRouter from './explore.js'

function createApp() {
  const app = express()
  app.use(express.json({ limit: '5mb' }))
  app.use('/api/github', githubRouter)
  app.use('/api/rclone', syncRouter)
  app.use('/api/upload', uploadRouter)
  app.use('/api/presentations', historyRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/media', mediaRouter)
  app.use('/api/live', liveRouter)
  app.use('/api/analytics', analyticsRouter)
  app.use('/api/explore', exploreRouter)
  return app
}

describe('API surface routes', () => {
  const app = createApp()

  beforeAll(() => {
    storage.initDataFiles()
    fs.ensureDirSync(storage.UPLOADS_DIR)
  })

  it('masks and preserves settings secrets', async () => {
    await storage.writeSettings({
      ai: { provider: 'openai', apiKey: 'real-secret' },
      defaultTheme: 'black',
    })

    const getRes = await request(app).get('/api/settings')
    expect(getRes.status).toBe(200)
    expect(getRes.body.ai.apiKey).toBe('***configured***')

    const updateRes = await request(app)
      .put('/api/settings')
      .send({ ai: { provider: 'gemini', apiKey: '***configured***' } })
    expect(updateRes.status).toBe(200)
    expect(updateRes.body.ai.apiKey).toBe('***configured***')

    const saved = await storage.readSettings()
    expect(saved.ai).toEqual({ provider: 'gemini', apiKey: 'real-secret' })
  })

  it('covers GitHub config and unconfigured push safeguards', async () => {
    await storage.writeGithubConfig({ token: '', owner: '', repo: '' })

    const emptyConfig = await request(app).get('/api/github/config')
    expect(emptyConfig.status).toBe(200)
    expect(emptyConfig.body).toEqual({ owner: '', repo: '', hasToken: false })

    const configRes = await request(app)
      .post('/api/github/config')
      .send({ token: 'ghp_secret', owner: 'owner', repo: 'repo' })
    expect(configRes.status).toBe(200)
    expect(configRes.body).toEqual({ owner: 'owner', repo: 'repo', hasToken: true })

    await storage.writeGithubConfig({ token: '', owner: '', repo: '' })
    const pushRes = await request(app).post('/api/github/push/missing').send({ message: 'test' })
    expect(pushRes.status).toBe(400)
    expect(pushRes.body.error).toContain('GitHub not configured')
  })

  it('redacts token-like GitHub push failures from API responses', async () => {
    const originalFetch = global.fetch
    await storage.writeGithubConfig({ token: 'ghp_phase5SecretToken', owner: 'owner', repo: 'repo' })
    await storage.writePresentations([
      {
        id: 'github-redaction',
        title: 'GitHub Redaction',
        slides: [{ id: 's1', elements: [] }],
      },
    ])
    global.fetch = async () => {
      throw new Error('GitHub network failure ghp_phase5SecretToken')
    }

    try {
      const pushRes = await request(app).post('/api/github/push/github-redaction').send({ message: 'test' })
      expect(pushRes.status).toBe(500)
      expect(pushRes.body.error).toContain('<REDACTED_TOKEN>')
      expect(pushRes.body.error).not.toContain('ghp_phase5SecretToken')
    } finally {
      global.fetch = originalFetch
    }
  })

  it('[cap:sync.rclone-status] covers rclone validation/status paths without requiring rclone credentials', async () => {
    const statusRes = await request(app).get('/api/rclone/status')
    expect(statusRes.status).toBe(200)
    expect(statusRes.body).toHaveProperty('installed')
    expect(statusRes.body).toHaveProperty('hasConfig')

    expect((await request(app).post('/api/rclone/config').send({ username: '' })).status).toBe(400)
    expect((await request(app).post('/api/rclone/sync').send({})).status).toBe(400)
    expect((await request(app).post('/api/rclone/sync-single').send({ remote: 'local' })).status).toBe(400)
  })

  it('uploads allowed media and supports list, metadata, filter, and delete', async () => {
    const uploadRes = await request(app)
      .post('/api/upload')
      .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'sample.svg')
    expect(uploadRes.status).toBe(200)
    expect(uploadRes.body.url).toMatch(/^\/uploads\//)

    const filename = path.basename(uploadRes.body.url)
    const updateRes = await request(app)
      .put(`/api/media/${filename}`)
      .send({ originalName: 'Diagram SVG', tags: ['diagram', 'svg'] })
    expect(updateRes.status).toBe(200)

    const listRes = await request(app).get('/api/media?type=image&search=diagram')
    expect(listRes.status).toBe(200)
    expect(listRes.body.some((item) => item.filename === filename && item.type === 'image')).toBe(true)

    const deleteRes = await request(app).delete(`/api/media/${filename}`)
    expect(deleteRes.status).toBe(200)
  }, 15000)

  it('[cap:import.upload-safety tier:deep] rejects non-SVG payloads uploaded with an SVG extension', async () => {
    const uploadRes = await request(app)
      .post('/api/upload')
      .attach('file', Buffer.from('not actually svg'), 'spoofed.svg')

    expect(uploadRes.status).toBe(400)
    expect(uploadRes.body.error).toBe('File content is not valid SVG')
    expect(uploadRes.body.code).toBe('invalid-svg')
  })

  it('accepts ogv uploads and lists them as video media', async () => {
    const uploadRes = await request(app)
      .post('/api/upload')
      .attach('file', Buffer.from('ogv placeholder bytes'), 'clip.ogv')
    expect(uploadRes.status).toBe(200)
    expect(uploadRes.body.url).toMatch(/^\/uploads\//)

    const filename = path.basename(uploadRes.body.url)
    const listRes = await request(app).get('/api/media?type=video')
    expect(listRes.status).toBe(200)
    expect(listRes.body.some((item) => item.filename === filename && item.type === 'video')).toBe(true)

    const deleteRes = await request(app).delete(`/api/media/${filename}`)
    expect(deleteRes.status).toBe(200)
  }, 15000)

  it('[cap:history.snapshot] covers history snapshot create/list/restore/delete', async () => {
    const presId = `history-${Date.now()}`
    await storage.writePresentations([
      {
        id: presId,
        title: 'Before',
        slides: [{ id: 's1', elements: [] }],
      },
    ])

    const snapshotRes = await request(app)
      .post(`/api/presentations/${presId}/snapshot`)
      .send({ name: 'Checkpoint' })
    expect(snapshotRes.status).toBe(200)
    expect(snapshotRes.body.name).toBe('Checkpoint')

    await storage.writePresentations([{ id: presId, title: 'After', slides: [] }])
    const listRes = await request(app).get(`/api/presentations/${presId}/snapshots`)
    expect(listRes.status).toBe(200)
    expect(listRes.body[0].slideCount).toBe(1)

    const restoreRes = await request(app).post(
      `/api/presentations/${presId}/restore/${snapshotRes.body.id}`
    )
    expect(restoreRes.status).toBe(200)
    expect(restoreRes.body.title).toBe('Before')

    const deleteRes = await request(app).delete(
      `/api/presentations/${presId}/snapshots/${snapshotRes.body.id}`
    )
    expect(deleteRes.status).toBe(200)
  })

  it('covers live room existence and analytics aggregation', async () => {
    const liveEvents = []
    const socketLeaves = []
    app.set('io', {
      to(roomId) {
        return {
          emit(event, payload) {
            liveEvents.push({ roomId, event, payload })
          },
        }
      },
      in(roomId) {
        return {
          socketsLeave(targetRoomId) {
            socketLeaves.push({ roomId, targetRoomId })
          },
        }
      },
    })

    const roomRes = await request(app).post('/api/live/room')
    expect(roomRes.status).toBe(200)
    expect(roomRes.body.roomCode).toHaveLength(6)
    expect(roomRes.body.presenterToken).toBeTruthy()

    const existsRes = await request(app).get(`/api/live/room/${roomRes.body.roomCode}`)
    expect(existsRes.status).toBe(200)
    expect(existsRes.body.exists).toBe(true)

    const deniedDeleteRes = await request(app).delete(`/api/live/room/${roomRes.body.roomCode}`)
    expect(deniedDeleteRes.status).toBe(403)

    const deleteRes = await request(app)
      .delete(`/api/live/room/${roomRes.body.roomCode}`)
      .set('Authorization', `Bearer ${roomRes.body.presenterToken}`)
    expect(deleteRes.status).toBe(204)
    expect(liveEvents).toContainEqual({
      roomId: roomRes.body.roomCode,
      event: 'room-ended',
      payload: { roomId: roomRes.body.roomCode },
    })
    expect(socketLeaves).toContainEqual({
      roomId: roomRes.body.roomCode,
      targetRoomId: roomRes.body.roomCode,
    })
    const deletedExistsRes = await request(app).get(`/api/live/room/${roomRes.body.roomCode}`)
    expect(deletedExistsRes.body.exists).toBe(false)

    await storage.writeShareTokens({
      analyticsToken: {
        presentationId: 'pres-analytics',
        name: 'Primary audience',
        createdAt: new Date().toISOString(),
      },
      secondaryToken: {
        presentationId: 'pres-analytics',
        name: 'Secondary audience',
        createdAt: new Date().toISOString(),
      },
    })

    await recordView(
      'pres-analytics',
      'analyticsToken',
      'https://ref.example/private/path?capability=secret'
    )
    await recordView('pres-analytics', 'secondaryToken', '')

    const analyticsRes = await request(app).get('/api/analytics/pres-analytics')
    expect(analyticsRes.status).toBe(200)
    expect(analyticsRes.headers['cache-control']).toBe('no-store')
    expect(analyticsRes.body.totalViews).toBeGreaterThanOrEqual(2)
    expect(analyticsRes.body.byLinkLabels['Primary audience']).toBeGreaterThanOrEqual(1)
    expect(analyticsRes.body.byLinkLabels['Secondary audience']).toBeGreaterThanOrEqual(1)
    expect(analyticsRes.body.dailyViews.length).toBeGreaterThanOrEqual(1)
    expect(analyticsRes.body.recentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ referrerHost: 'ref.example' }),
      ])
    )
    const responseText = JSON.stringify(analyticsRes.body)
    expect(responseText).not.toContain('analyticsToken')
    expect(responseText).not.toContain('secondaryToken')
    expect(responseText).not.toContain('/private/path')
    expect(responseText).not.toContain('capability=secret')
    expect(analyticsRes.body).not.toHaveProperty('byToken')
  })

  it('filters deleted presentations from explore even when share tokens remain', async () => {
    await storage.writePresentations([
      { id: 'pres-active', title: 'Active', slides: [] },
      { id: 'pres-deleted', title: 'Deleted', slides: [], deletedAt: new Date().toISOString() },
    ])
    await storage.writeShareTokens({
      activeToken: { presentationId: 'pres-active' },
      deletedToken: { presentationId: 'pres-deleted' },
    })

    const res = await request(app).get('/api/explore')
    expect(res.status).toBe(200)
    expect(res.body.presentations.some((item) => item.id === 'pres-active')).toBe(true)
    expect(res.body.presentations.some((item) => item.id === 'pres-deleted')).toBe(false)
  })
})
