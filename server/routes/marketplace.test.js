import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'

import marketplaceRouter from './marketplace.js'

describe('Marketplace API', () => {
  const app = express()
  app.use(express.json())
  app.use('/api/marketplace', marketplaceRouter)

  it('should return marketplace categories and templates', async () => {
    const res = await request(app).get('/api/marketplace/templates')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('categories')

    // Check if the new category 'hr' exists
    expect(res.body.categories.some((c) => c.id === 'hr')).toBe(true)
    expect(res.body.categories.some((c) => c.id === 'minimal')).toBe(true)

    // Check if templates are returned
    expect(res.body.templates.length).toBeGreaterThan(0)
  })

  it('should filter templates by a single category', async () => {
    const res = await request(app).get('/api/marketplace/templates?category=military')
    expect(res.status).toBe(200)
    expect(res.body.templates.every((t) => t.category === 'military')).toBe(true)
  })

  it('should filter templates by category ids that are stored as tags', async () => {
    const res = await request(app).get('/api/marketplace/templates?category=interactive')
    expect(res.status).toBe(200)
    expect(res.body.templates.length).toBeGreaterThanOrEqual(1)
    expect(
      res.body.templates.every(
        (t) => t.category === 'interactive' || (t.tags || []).includes('interactive')
      )
    ).toBe(true)
  })

  it('should filter templates by multiple tags if any template has them', async () => {
    const res = await request(app).get('/api/marketplace/templates?tags=military,briefing')
    expect(res.status).toBe(200)
    // There should be at least one template matching this in the real JSON
    expect(res.body.templates.length).toBeGreaterThanOrEqual(1)
    expect(
      res.body.templates.every((t) => t.tags.includes('military') && t.tags.includes('briefing'))
    ).toBe(true)
  })

  it('should filter templates by repeated tags query params', async () => {
    const res = await request(app).get('/api/marketplace/templates?tags=military&tags=briefing')
    expect(res.status).toBe(200)
    expect(res.body.templates.length).toBeGreaterThanOrEqual(1)
    expect(
      res.body.templates.every((t) => t.tags.includes('military') && t.tags.includes('briefing'))
    ).toBe(true)
  })

  it('normalizes built-in slide backgrounds and element metadata in responses', async () => {
    const res = await request(app).get('/api/marketplace/templates/digi-lecture-overview')
    expect(res.status).toBe(200)
    expect(res.body.slides[0].background).toMatchObject({ type: 'color', color: '#0a1628' })

    for (const [slideIndex, slide] of res.body.slides.entries()) {
      for (const [elementIndex, element] of (slide.elements || []).entries()) {
        expect(typeof element.id, `slides[${slideIndex}].elements[${elementIndex}].id`).toBe(
          'string'
        )
        expect(
          typeof element.zIndex,
          `slides[${slideIndex}].elements[${elementIndex}].zIndex`
        ).toBe('number')
      }
    }
  })
})
