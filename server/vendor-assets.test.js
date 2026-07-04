import express from 'express'
import path from 'node:path'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

const app = express()
app.use('/vendor', express.static(path.join(process.cwd(), 'server', 'vendor')))

describe('vendor assets', () => {
  it.each([
    '/vendor/chart.js/dist/chart.umd.js',
    '/vendor/katex/dist/katex.min.css',
    '/vendor/katex/dist/katex.min.js',
    '/vendor/tikzjax/fonts.css',
    '/vendor/tikzjax/tikzjax.js',
  ])('serves %s locally', async (assetPath) => {
    const res = await request(app).get(assetPath)
    expect(res.status).toBe(200)
  })
})
