const assert = require('assert');

// Simulate the History Engine logic implemented in DocumentContext
function createHistoryEngine(initialDoc, initialActiveId) {
  let doc = JSON.parse(JSON.stringify(initialDoc));
  let activeElementId = initialActiveId;

  let history = [
    {
      doc: JSON.parse(JSON.stringify(initialDoc)),
      activeElementId: initialActiveId,
    },
  ];
  let historyIdx = 0;
  let isDirty = false;

  let typingTimer = null;
  let lastTypingInfo = null;

  function updateCanUndoRedo() {
    return {
      canUndo: historyIdx > 0,
      canRedo: historyIdx < history.length - 1,
    };
  }

  function recordSnapshot(newDoc, targetActiveId) {
    const docToRecord = newDoc || doc;
    const activeIdToRecord = targetActiveId !== undefined ? targetActiveId : activeElementId;
    const snap = {
      doc: JSON.parse(JSON.stringify(docToRecord)),
      activeElementId: activeIdToRecord,
    };

    history = history.slice(0, historyIdx + 1);
    history.push(snap);

    if (history.length > 150) {
      history.shift();
    }

    historyIdx = history.length - 1;
    isDirty = true;
  }

  function flushTypingCheckpoint() {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    const currentSnap = history[historyIdx];
    if (currentSnap) {
      if (JSON.stringify(doc) !== JSON.stringify(currentSnap.doc)) {
        recordSnapshot(doc, activeElementId);
      }
    }
    lastTypingInfo = null;
  }

  function undo() {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }

    const currentHead = history[historyIdx];
    if (currentHead && JSON.stringify(doc) !== JSON.stringify(currentHead.doc)) {
      history = history.slice(0, historyIdx + 1);
      history.push({
        doc: JSON.parse(JSON.stringify(doc)),
        activeElementId,
      });
      historyIdx = history.length - 1;
    }

    lastTypingInfo = null;

    if (historyIdx > 0) {
      historyIdx -= 1;
      const target = history[historyIdx];
      doc = JSON.parse(JSON.stringify(target.doc));
      if (target.activeElementId) {
        activeElementId = target.activeElementId;
      }
      isDirty = true;
    }
  }

  function redo() {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    lastTypingInfo = null;

    if (historyIdx < history.length - 1) {
      historyIdx += 1;
      const target = history[historyIdx];
      doc = JSON.parse(JSON.stringify(target.doc));
      if (target.activeElementId) {
        activeElementId = target.activeElementId;
      }
      isDirty = true;
    }
  }

  function updateElement(id, updates) {
    const isEvaluatingOnly = updates.isEvaluating === true && Object.keys(updates).length === 1;

    doc.elements = doc.elements.map((el) => {
      if (el.id === id) {
        return { ...el, ...updates };
      }
      return el;
    });
    isDirty = true;

    if (isEvaluatingOnly) return;

    const isTyping = 'input' in updates || 'content' in updates || 'title' in updates;

    if (!isTyping) {
      flushTypingCheckpoint();
      recordSnapshot(undefined, id);
      return;
    }

    const field = 'input' in updates ? 'input' : 'content' in updates ? 'content' : 'title';
    const value = String(updates[field] ?? '');

    const prevInfo = lastTypingInfo;
    const now = Date.now();

    if (prevInfo && (prevInfo.elementId !== id || prevInfo.field !== field)) {
      flushTypingCheckpoint();
    }

    const prevValue = prevInfo ? prevInfo.value : '';
    const isDeleting = value.length < prevValue.length;

    if (prevInfo && prevInfo.isDeleting !== isDeleting && prevValue !== value) {
      flushTypingCheckpoint();
    }

    let isBoundary = false;
    if (field === 'input') {
      const lastChar = value.slice(-1);
      isBoundary = /[+\-*\/=^()_,\s\\]/.test(lastChar);
    } else {
      const lastChar = value.slice(-1);
      isBoundary = /[\s.,!?;:\n]/.test(lastChar);
    }

    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }

    const timeSinceLast = prevInfo ? now - prevInfo.lastCheckpointTime : 0;
    const charDiff = Math.abs(value.length - (prevInfo ? prevInfo.value.length : 0));

    if (isBoundary && (timeSinceLast > 250 || charDiff >= 2)) {
      recordSnapshot(undefined, id);
      lastTypingInfo = {
        elementId: id,
        field,
        value,
        isDeleting,
        lastCheckpointTime: now,
      };
    } else {
      lastTypingInfo = {
        elementId: id,
        field,
        value,
        isDeleting,
        lastCheckpointTime: prevInfo ? prevInfo.lastCheckpointTime : now,
      };
    }
  }

  function insertElement(type, afterId) {
    flushTypingCheckpoint();
    const newId = 'el-' + Math.random().toString(36).slice(2, 7);
    const newEl = { id: newId, type, input: '', content: '' };
    doc.elements.push(newEl);
    activeElementId = newId;
    recordSnapshot(doc, newId);
    return newId;
  }

  function deleteElement(id) {
    flushTypingCheckpoint();
    const idx = doc.elements.findIndex((e) => e.id === id);
    if (idx !== -1) {
      doc.elements.splice(idx, 1);
      const nextActive = doc.elements[Math.max(0, idx - 1)]?.id || null;
      activeElementId = nextActive;
      recordSnapshot(doc, nextActive);
    }
  }

  return {
    getDoc: () => doc,
    getActiveElementId: () => activeElementId,
    getHistoryCount: () => history.length,
    getHistoryIndex: () => historyIdx,
    updateCanUndoRedo,
    updateElement,
    insertElement,
    deleteElement,
    flushTypingCheckpoint,
    undo,
    redo,
  };
}

// ==========================================
// TEST SUITE
// ==========================================
console.log('--- Running History Engine Unit Tests ---');

// Test 1: Initial state
const engine = createHistoryEngine(
  { title: 'Doc', elements: [{ id: 'el-1', type: 'math', input: '' }] },
  'el-1'
);
assert.strictEqual(engine.getHistoryCount(), 1);
assert.strictEqual(engine.getHistoryIndex(), 0);
assert.strictEqual(engine.updateCanUndoRedo().canUndo, false);
assert.strictEqual(engine.updateCanUndoRedo().canRedo, false);
console.log('✓ Initial history state is correct (canUndo: false, canRedo: false)');

// Test 2: Typing math formula with operators creates granular checkpoints
engine.updateElement('el-1', { input: 'x' });
engine.updateElement('el-1', { input: 'x^' });
engine.updateElement('el-1', { input: 'x^2' });
// Boundary operator '+'
engine.updateElement('el-1', { input: 'x^2 +' });
assert(engine.getHistoryCount() > 1, 'Checkpoint created on boundary');
const countAfterOperator = engine.getHistoryCount();

engine.updateElement('el-1', { input: 'x^2 + 5' });
engine.updateElement('el-1', { input: 'x^2 + 5x' });
// Simulate typing pause (debounce flush)
engine.flushTypingCheckpoint();
assert(engine.getHistoryCount() > countAfterOperator, 'Checkpoint created after typing pause');

// Test 3: Granular undo
console.log('Doc before undo:', engine.getDoc().elements[0].input);
assert.strictEqual(engine.getDoc().elements[0].input, 'x^2 + 5x');

engine.undo();
console.log('Doc after 1st undo:', engine.getDoc().elements[0].input);
assert.strictEqual(engine.getDoc().elements[0].input, 'x^2 +', '1st undo reverted to previous boundary without wiping line');

engine.undo();
console.log('Doc after 2nd undo:', engine.getDoc().elements[0].input);
assert.strictEqual(engine.getDoc().elements[0].input, '', '2nd undo reverted to initial empty state');

// Test 4: Redo
engine.redo();
assert.strictEqual(engine.getDoc().elements[0].input, 'x^2 +');
engine.redo();
assert.strictEqual(engine.getDoc().elements[0].input, 'x^2 + 5x');
console.log('✓ Undo and Redo accurately step through formula editing checkpoints');

// Test 5: Backspace direction change
// User has 'x^2 + 5x', now starts deleting characters
engine.updateElement('el-1', { input: 'x^2 + 5' });
engine.updateElement('el-1', { input: 'x^2 + ' });
engine.flushTypingCheckpoint();

assert.strictEqual(engine.getDoc().elements[0].input, 'x^2 + ');
engine.undo();
assert.strictEqual(engine.getDoc().elements[0].input, 'x^2 + 5x', 'Undo after deletion restored deleted characters');
console.log('✓ Direction change between typing and deleting creates a clean checkpoint');

// Test 6: Structural operations (insert/delete lines)
const newId = engine.insertElement('math', 'el-1');
assert.strictEqual(engine.getDoc().elements.length, 2);
assert.strictEqual(engine.getActiveElementId(), newId);

engine.updateElement(newId, { input: 'y = 10' });
engine.flushTypingCheckpoint();

engine.undo(); // undoes typing 'y = 10'
assert.strictEqual(engine.getDoc().elements[1].input, '');

engine.undo(); // undoes insertion of line 2
assert.strictEqual(engine.getDoc().elements.length, 1);
assert.strictEqual(engine.getActiveElementId(), 'el-1');

engine.redo(); // recreates line 2
assert.strictEqual(engine.getDoc().elements.length, 2);
assert.strictEqual(engine.getActiveElementId(), newId);

engine.redo(); // restores 'y = 10'
assert.strictEqual(engine.getDoc().elements[1].input, 'y = 10');
console.log('✓ Structural insertion and line undo/redo work seamlessly with cursor restoration');

console.log('\nAll History Engine tests passed successfully!');
