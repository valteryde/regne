const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../src/engine/sympyWorker.py');
const destDir = path.resolve(__dirname, '../dist/engine');
const dest = path.resolve(destDir, 'sympyWorker.py');

if (fs.existsSync(src)) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log('[copy-worker] Copied sympyWorker.py to dist/engine/sympyWorker.py');
} else {
  console.warn('[copy-worker] Source worker script not found at:', src);
}
