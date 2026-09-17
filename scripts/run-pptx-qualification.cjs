#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { runFromCli } = require('../server/services/pptx-import/pptx-import-corpus-cli.js');

function computeFileSha256(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch {
    return null;
  }
}

async function main() {
  const magickBin = 'C:\\Program Files\\ImageMagick-7.1.2-Q16-HDRI\\magick.exe';
  const hasMagick = fs.existsSync(magickBin);

  const env = { ...process.env };
  if (hasMagick) {
    process.env.PPTX_EMF_CONVERT = '1'; env.PPTX_EMF_CONVERT = '1';
    process.env.PPTX_EMF_BINARY = magickBin; env.PPTX_EMF_BINARY = magickBin;
    process.env.PPTX_EMF_BINARY_ROOT = path.dirname(magickBin); env.PPTX_EMF_BINARY_ROOT = path.dirname(magickBin);
    const sha = computeFileSha256(magickBin);
    if (sha) {
      process.env.PPTX_EMF_BINARY_SHA256 = sha; env.PPTX_EMF_BINARY_SHA256 = sha;
    }
  }

  const manifestPath = path.resolve('server/data/test-corpus/importer-qualification-manifest.json');
  const outEvidencePath = path.resolve('tests/fixtures/pptx-corpus/pptx-qualification-evidence.json');

  console.log('[PPTX-QUAL] Starting native qualification with manifest:', manifestPath);
  console.log('[PPTX-QUAL] EMF converter configured:', hasMagick ? magickBin : 'none');

  const args = [
    '--importer-strict',
    `--manifest-in=${manifestPath}`,
    `--qualification-out=${outEvidencePath}`,
  ];

  const code = await runFromCli(args, {
    env,
    stdout: process.stdout,
    stderr: process.stderr,
    outputJson: (targetPath, payload) => {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');
      console.log('[PPTX-QUAL] Wrote qualification report to:', targetPath);
    },
  });

  console.log('[PPTX-QUAL] Finished with exit code:', code);
  process.exit(code);
}

main().catch((err) => {
  console.error('[PPTX-QUAL] Fatal error:', err);
  process.exit(1);
});
