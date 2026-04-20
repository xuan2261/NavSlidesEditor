import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

// We mock fs to provide a fake built-in-templates.json
import { vi } from 'vitest';

const mockData = {
  categories: [
    {
      id: 'military',
      name: 'Quân sự',
      templates: [
        { id: 'mil-tactical', title: 'Tactical Briefing' }
      ]
    }
  ]
};

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn((file) => {
      if (file.includes('built-in-templates.json')) return true;
      return actual.existsSync(file);
    }),
    readFileSync: vi.fn((file, encoding) => {
      if (file.includes('built-in-templates.json')) {
        return JSON.stringify(mockData);
      }
      return actual.readFileSync(file, encoding);
    })
  };
});

import marketplaceRouter from './marketplace.js';

describe('Marketplace API', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/marketplace', marketplaceRouter);

  it('should return marketplace categories and templates', async () => {
    const res = await request(app).get('/api/marketplace/templates');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('categories');
    expect(res.body.categories[0].id).toBe('military');
    expect(res.body.templates[0].id).toBe('mil-tactical');
  });
});
