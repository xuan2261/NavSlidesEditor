import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import * as storage from '../services/storage.js';
import shareRouter from './share.js';

describe('Share API', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/presentations', shareRouter);

  let presId = 'pres-1';
  let initialTokens = {};

  beforeAll(async () => {
    storage.initDataFiles();
    let presentations = await storage.readPresentations();
    if (presentations.length === 0) {
      // Create a dummy presentation for CI testing
      presentations = [{ id: 'pres-1', title: 'Test', slides: [] }];
      await storage.writePresentations(presentations);
    }
    presId = presentations[0].id;
  });

  beforeEach(async () => {
    initialTokens = await storage.readShareTokens();
  });

  it('should upgrade old string token to object', async () => {
    const tokens = { ...initialTokens, 'old-token': presId };
    await storage.writeShareTokens(tokens);
    const res = await request(app).get(`/api/presentations/${presId}/shares`);
    expect(res.status).toBe(200);
  });

  it('should create a new share link with password and expiry', async () => {
    const res = await request(app)
      .post(`/api/presentations/${presId}/share`)
      .send({ name: 'Client Link', password: 'secret123', expiresInDays: 7 });
    
    if (res.status !== 200) console.error(res.body, res.text);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    
    const token = res.body.token;
    const tokens = await storage.readShareTokens();
    expect(tokens[token].presentationId).toBe(presId);
    expect(tokens[token].name).toBe('Client Link');
    
    // check password hash
    const isValid = await bcrypt.compare('secret123', tokens[token].password);
    expect(isValid).toBe(true);
  });

  it('should list all share links for a presentation', async () => {
    const tokens = {
      ...initialTokens,
      't1': { presentationId: presId, name: 'A' },
      't2': { presentationId: presId, name: 'B' },
      't3': { presentationId: 'other', name: 'C' }
    };
    await storage.writeShareTokens(tokens);
    const res = await request(app).get(`/api/presentations/${presId}/shares`);
    expect(res.status).toBe(200);
    expect(res.body.shares.length).toBeGreaterThanOrEqual(2);
  });
});
