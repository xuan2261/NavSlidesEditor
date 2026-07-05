import { describe, expect, it } from 'vitest'
import { filterMarketplaceTemplates, matchesTemplateCategory } from './template-filters'
import { normalizeTemplateMetadata } from './template-metadata'

const templates = [
  {
    id: 'pitch',
    title: 'Pitch Deck',
    description: 'Startup deck',
    category: 'business',
    tags: ['minimal', 'chart-heavy'],
  },
  {
    id: 'lab',
    title: 'Lab Simulation',
    titleVi: 'Mô phỏng phòng lab',
    description: 'Interactive engineering deck',
    category: 'electronics',
    tags: ['interactive', 'dark'],
  },
]

describe('template marketplace filters', () => {
  it('matches category ids stored as tags', () => {
    expect(matchesTemplateCategory(templates[1], 'interactive')).toBe(true)
    expect(matchesTemplateCategory(templates[0], 'interactive')).toBe(false)
  })

  it('filters by category-or-tag and search text', () => {
    expect(filterMarketplaceTemplates(templates, 'chart-heavy', '').map((t) => t.id)).toEqual([
      'pitch',
    ])
    expect(filterMarketplaceTemplates(templates, 'interactive', 'lab').map((t) => t.id)).toEqual([
      'lab',
    ])
    expect(filterMarketplaceTemplates(templates, '', 'mô phỏng').map((t) => t.id)).toEqual([
      'lab',
    ])
  })

  it('normalizes missing template metadata before filtering', () => {
    const [normalized] = filterMarketplaceTemplates(
      [{ id: 'metadata-only', name: 'Fallback Deck', tags: 'bad-tags' }],
      '',
      'fallback'
    )

    expect(normalized).toMatchObject({
      id: 'metadata-only',
      title: 'Fallback Deck',
      description: '',
      category: 'uncategorized',
      tags: [],
      slides: [],
      slideCount: 0,
    })
  })

  it('preserves Vietnamese title fields while deriving safe display defaults', () => {
    expect(normalizeTemplateMetadata({ titleVi: 'Bài giảng', tags: ['education'] })).toMatchObject({
      title: 'Bài giảng',
      titleVi: 'Bài giảng',
      tags: ['education'],
    })
  })
})
