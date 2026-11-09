import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LETTERS, QueryPlanner } from '../src/engine/expansion.js';

/** Runs a planner against a fake suggestion function; returns the searches made in order. */
function drive(planner, suggest, limit = 10000) {
  const made = [];
  for (let i = 0; i < limit; i++) {
    const item = planner.next();
    if (!item) break;
    made.push(item);
    planner.record(item.text, item.step, suggest(item.text, item.step));
  }
  return made;
}

test('steps 1–2: genre, then genre + a…z', () => {
  const p = new QueryPlanner({ genre: 'forest', budget: 27 });
  const made = drive(p, () => []);
  assert.deepEqual(made[0], { text: 'forest', step: 1 });
  assert.deepEqual(
    made.slice(1).map((m) => m.text),
    LETTERS.map((l) => `forest ${l}`),
  );
  assert.ok(made.slice(1).every((m) => m.step === 2));
  assert.equal(p.stopReason, 'budget');
});

test('step 3 searches suggestions found in steps 1–2 in discovery order, then step 4', () => {
  const p = new QueryPlanner({ genre: 'forest', budget: 40 });
  const suggest = (text, step) => {
    if (text === 'forest') return ['Forest Animals', 'forest', 'forest tycoon'];
    if (text === 'forest b') return ['forest bear', 'forest animals'];
    if (step === 3) return ['forest deep secret']; // found in step 3: not searched in step 3
    return [];
  };
  const made = drive(p, suggest);
  const step3 = made.filter((m) => m.step === 3).map((m) => m.text);
  assert.deepEqual(step3, ['forest animals', 'forest tycoon', 'forest bear']);
  const firstStep4 = made.find((m) => m.step === 4);
  assert.equal(firstStep4.text, 'forest aa');
  assert.ok(made.indexOf(firstStep4) > made.findLastIndex((m) => m.step === 3));
});

test('never searches the same text twice', () => {
  const p = new QueryPlanner({ genre: 'horror', budget: 2000 });
  const suggest = (text) => ['horror a', 'horror', `${text} q`, 'horror story'];
  const made = drive(p, suggest);
  const texts = made.map((m) => m.text);
  assert.equal(new Set(texts).size, texts.length);
  assert.equal(made.length, 2000);
  assert.equal(p.stopReason, 'budget');
});

test('stops with "exhausted" when nothing is left before the budget', () => {
  const p = new QueryPlanner({ genre: 'zzq', budget: 2000 });
  const made = drive(p, () => []);
  assert.equal(made.length, 1 + 26 + 26 * 26);
  assert.equal(p.stopReason, 'exhausted');
  assert.equal(p.next(), null);
});

test('step 5 extends the best-scoring searches with a letter and re-ranks as data arrives', () => {
  const p = new QueryPlanner({ genre: 'forest', budget: 2000, rerankEvery: 2 });
  let injected = false;
  const step5 = [];
  const suggest = (text, step) => {
    if (text === 'forest') return ['forest strong', 'forest weak'];
    if (step === 5) {
      step5.push(text);
      if (!injected) {
        injected = true;
        // A suggestion that suddenly dominates: it appears at rank 1 in many searches.
        return ['forest boom'];
      }
    }
    return [];
  };
  // Boost "forest boom" so that it outranks everything once it is seen.
  const origRecord = p.record.bind(p);
  p.record = (text, stepNo, s) => {
    origRecord(text, stepNo, s);
    if (s.includes('forest boom')) p.scores.set('forest boom', 1000);
  };
  drive(p, suggest, 1 + 26 + 2 + 676 + 6);
  assert.equal(step5[0], 'forest strong a');
  assert.ok(step5.includes('forest boom a'), `step 5 searches were ${step5.join(', ')}`);
  assert.ok(step5.indexOf('forest boom a') <= 3);
});

test('budget counts only searches that returned data', () => {
  const p = new QueryPlanner({ genre: 'forest', budget: 3 });
  const a = p.next();
  p.next(); // request failed: not recorded
  p.record(a.text, a.step, []);
  const c = p.next();
  p.record(c.text, c.step, []);
  const d = p.next();
  p.record(d.text, d.step, []);
  assert.equal(p.made, 3);
  assert.equal(p.next(), null);
  assert.equal(p.stopReason, 'budget');
});
