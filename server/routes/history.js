const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const { readPresentations, writePresentations, HISTORY_DIR } = require('../services/storage');

const router = express.Router();

// POST /api/presentations/:id/snapshot
router.post('/:id/snapshot', async (req, res) => {
  try {
    const presentations = await readPresentations();
    const pres = presentations.find((p) => p.id === req.params.id);
    if (!pres) return res.status(404).json({ error: 'Not found' });
    const name = req.body.name || new Date().toISOString();
    const presDir = path.join(HISTORY_DIR, req.params.id);
    fs.ensureDirSync(presDir);
    const snapshotId = uuidv4();
    const snapshot = {
      id: snapshotId,
      name,
      createdAt: new Date().toISOString(),
      data: JSON.parse(JSON.stringify(pres)),
    };
    fs.writeJsonSync(path.join(presDir, `${snapshotId}.json`), snapshot, { spaces: 2 });
    res.json({ id: snapshotId, name, createdAt: snapshot.createdAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/presentations/:id/snapshots
router.get('/:id/snapshots', async (req, res) => {
  try {
    const presDir = path.join(HISTORY_DIR, req.params.id);
    if (!fs.existsSync(presDir)) return res.json([]);
    const files = (await fs.readdir(presDir))
      .filter((f) => f.endsWith('.json'))
      .sort();
    const snapshots = [];
    for (const f of files) {
      try {
        const s = await fs.readJson(path.join(presDir, f));
        snapshots.push({
          id: s.id, name: s.name, createdAt: s.createdAt,
          slideCount: (s.data?.slides || []).length,
        });
      } catch {}
    }
    snapshots.reverse();
    res.json(snapshots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/presentations/:id/restore/:snapshotId
router.post('/:id/restore/:snapshotId', async (req, res) => {
  try {
    const presDir = path.join(HISTORY_DIR, req.params.id);
    const snapFile = path.join(presDir, `${req.params.snapshotId}.json`);
    if (!fs.existsSync(snapFile)) return res.status(404).json({ error: 'Snapshot not found' });
    const snapshot = fs.readJsonSync(snapFile);
    const presentations = await readPresentations();
    const index = presentations.findIndex((p) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Presentation not found' });
    presentations[index] = {
      ...snapshot.data,
      id: req.params.id,
      updatedAt: new Date().toISOString(),
    };
    await writePresentations(presentations);
    res.json(presentations[index]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/presentations/:id/snapshots/:snapshotId
router.delete('/:id/snapshots/:snapshotId', async (req, res) => {
  try {
    const snapFile = path.join(HISTORY_DIR, req.params.id, `${req.params.snapshotId}.json`);
    if (fs.existsSync(snapFile)) fs.removeSync(snapFile);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
