const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
// eslint-disable-next-line unused-imports/no-unused-vars
const { generateRevealHTML } = require('revealjs-shared');
const {
  readShareTokens, writeShareTokens, readPresentations,
} = require('../services/storage');

const router = express.Router();

function sanitizeToken(tokenData) {
  if (typeof tokenData === 'string') {
    return { presentationId: tokenData, views: 0, createdAt: new Date().toISOString() };
  }
  return tokenData;
}

// GET /api/presentations/:id/shares - List all share links for presentation
router.get('/:id/shares', async (req, res) => {
  try {
    const tokensRaw = await readShareTokens();
    const shares = Object.entries(tokensRaw)
      .map(([token, data]) => {
        const sanitized = sanitizeToken(data);
        return { token, ...sanitized };
      })
      .filter((share) => share.presentationId === req.params.id)
      .map(share => {
        // don't send password hash to client
        const { password, ...rest } = share;
        return { ...rest, isProtected: !!password };
      });
      
    res.json({ shares });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const shareBodySchema = z.object({
  name: z.string().max(200).optional(),
  password: z.string().max(128).optional(),
  expiresInDays: z.number().positive().max(365).optional(),
}).passthrough();

// POST /api/presentations/:id/share - create a new share link
router.post('/:id/share', validate(shareBodySchema), async (req, res) => {
  try {
    const presentations = await readPresentations();
    const presentation = presentations.find((p) => p.id === req.params.id);
    if (!presentation) return res.status(404).json({ error: 'Not found' });

    const tokens = await readShareTokens();
    const { name, password, expiresInDays } = req.body;
    
    // Normalize existing string tokens first
    for (const t of Object.keys(tokens)) {
      tokens[t] = sanitizeToken(tokens[t]);
    }
    
    const token = uuidv4();
    const newToken = {
      presentationId: req.params.id,
      name: name || 'Shared Link',
      views: 0,
      createdAt: new Date().toISOString(),
    };
    
    if (password) {
      newToken.password = await bcrypt.hash(password, 10);
    }
    
    if (expiresInDays) {
      const ms = expiresInDays * 24 * 60 * 60 * 1000;
      newToken.expiresAt = new Date(Date.now() + ms).toISOString();
    }

    tokens[token] = newToken;
    await writeShareTokens(tokens);
    
    res.json({ token, shared: true, data: { ...newToken, password: undefined, isProtected: !!password } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Note: DELETE /api/presentations/:id/share was used previously to delete ALL shares
// We redefine it to delete a specific share by token
// Since this router is mounted on `/api/presentations`, we'll need to be careful with paths.
// The new Phase 5 specifies DELETE /api/shares/:token.
// This requires mounting it separately or using `../shares/:token` but this router is mounted as `/api/presentations`.
// We will export a generic router that mounts at `/api/shares` as well. Wait, `shareRouter` handles both currently?
// No, index.js does: `app.use('/api/presentations', shareRouter)`

// Old delete route (disable all sharing)
router.delete('/:id/share', async (req, res) => {
  try {
    const tokens = await readShareTokens();
    let modified = false;
    for (const [token, data] of Object.entries(tokens)) {
      const sanitized = sanitizeToken(data);
      if (sanitized.presentationId === req.params.id) {
        delete tokens[token];
        modified = true;
      }
    }
    if (modified) await writeShareTokens(tokens);
    res.json({ shared: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/presentations/:id/share - legacy
router.get('/:id/share', async (req, res) => {
  try {
    const tokens = await readShareTokens();
    // eslint-disable-next-line unused-imports/no-unused-vars
    const entry = Object.entries(tokens).find(([t, data]) => sanitizeToken(data).presentationId === req.params.id);
    res.json({ shared: !!entry, token: entry ? entry[0] : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
