const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { hitsInText, isInsideRoot, listDirectory, searchFolder } = require('../dist/main/workspaceFiles.js');

test('hitsInText records the line and UTF-16 offset', () => {
  const text = 'alpha\nBeta target\n';
  const hits = hitsInText('note.regne', text, 'target', 10);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 2);
  assert.equal(hits[0].offset, text.indexOf('target'));
  assert.equal(hits[0].preview.slice(hits[0].matchStart, hits[0].matchStart + hits[0].matchLength), 'target');
});

test('hitsInText matches without regard to case', () => {
  const text = 'Temperature';
  const hits = hitsInText('note.regne', text, 'temp', 10);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].offset, 0);
  assert.equal(hits[0].preview.slice(0, 4), 'Temp');
});

test('search stays inside the folder and skips hidden and dependency directories', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'regne-search-'));
  try {
    await fs.writeFile(path.join(root, 'visible.regne'), 'cylinder pressure\n');
    await fs.mkdir(path.join(root, '.git'));
    await fs.writeFile(path.join(root, '.git', 'hidden.regne'), 'cylinder secret\n');
    await fs.mkdir(path.join(root, 'node_modules'));
    await fs.writeFile(path.join(root, 'node_modules', 'dep.regne'), 'cylinder package\n');
    await fs.mkdir(path.join(root, 'notes'));
    await fs.writeFile(path.join(root, 'notes', 'other.txt'), 'nope\ncylinder again\n');
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'regne-outside-'));
    try {
      await assert.rejects(() => listDirectory(root, outside));
      assert.equal(isInsideRoot(root, outside), false);
      const entries = await listDirectory(root, root);
      assert.deepEqual(
        entries.map((entry) => entry.name).sort(),
        ['.git', 'node_modules', 'notes', 'visible.regne'],
      );
      const firstFile = entries.findIndex((entry) => !entry.isDirectory);
      assert.ok(entries.slice(0, firstFile).every((entry) => entry.isDirectory));
      assert.equal(entries[firstFile].name, 'visible.regne');
      const { hits, truncated } = await searchFolder(root, 'cylinder');
      assert.equal(truncated, false);
      const files = hits.map((hit) => path.basename(hit.filePath)).sort();
      assert.deepEqual(files, ['other.txt', 'visible.regne']);
      const nested = hits.find((hit) => hit.filePath.endsWith('other.txt'));
      assert.equal(nested.line, 2);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
