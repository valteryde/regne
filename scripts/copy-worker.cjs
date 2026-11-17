const fs = require('fs');
const path = require('path');

const destDir = path.resolve(__dirname, '../dist/engine');
const files = ['sympyWorker.py', 'irEval.py'];

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

for (const name of files) {
  const src = path.resolve(__dirname, '../src/engine', name);
  if (!fs.existsSync(src)) {
    console.warn('[copy-worker] Source worker script not found at:', src);
    continue;
  }
  fs.copyFileSync(src, path.resolve(destDir, name));
  console.log(`[copy-worker] Copied ${name} to dist/engine/${name}`);
}
