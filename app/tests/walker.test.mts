/** Run: npm test   (node --test, no extra deps) */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { inScope, Protocol } from '../src/content/schema.ts';
import { walk } from '../src/content/walker.ts';

const load = (id: string) =>
  Protocol.parse(JSON.parse(readFileSync(new URL(`../content/protocols/${id}.json`, import.meta.url), 'utf8')));

test('linear steps chain until the first decision', () => {
  const p = load('4010');
  const r = walk(p, []);
  assert.deepEqual(r.entries.map((e) => e.id), ['ams', 'abcs', 'persistent']);
  assert.equal(r.pending?.id, 'persistent');
  assert.equal(r.ended, false);
});

test('choosing Yes on Persistent AMS walks the full workup to the end', () => {
  const p = load('4010');
  const r = walk(p, [0]);
  assert.equal(r.entries.at(-1)?.id, 'transport');
  assert.ok(r.entries.some((e) => e.id === 'bgl'));
  assert.equal(r.ended, true);
  assert.equal(r.pending, null);
});

test('choosing No goes to the transient-event box then transport', () => {
  const r = walk(load('4010'), [1]);
  assert.deepEqual(r.entries.slice(3).map((e) => e.id), ['transient', 'transport']);
});

test('arrest algorithm loops through repeated rhythm checks', () => {
  const p = load('3000');
  // shockable-1 Yes → vtvf → shockable-2 Yes → shock-epi → shockable-3 Yes → antiarrhythmic → shockable-2 ...
  const r = walk(p, [0, 0, 0, 0]);
  const ids = r.entries.map((e) => e.id);
  assert.equal(ids.filter((i) => i === 'shockable-2').length, 2);
  assert.equal(r.pending?.id, 'shockable-3');
});

test('goto nodes with a return path continue the flow', () => {
  const p = load('2010');
  const r = walk(p, [1]); // patent airway? No → obstructed airway → ventilations?
  assert.deepEqual(r.entries.slice(-2).map((e) => e.id), ['goto-obstructed', 'ventilations']);
});

test('out-of-range choices are ignored rather than crashing', () => {
  const r = walk(load('4010'), [7]);
  assert.equal(r.pending?.id, 'persistent');
});

test('scope ordering', () => {
  assert.ok(inScope('ALL', 'EMT'));
  assert.ok(inScope('EMT', 'EMT'));
  assert.ok(!inScope('AEMT', 'EMT'));
  assert.ok(!inScope('PARAMEDIC', 'EMT-I'));
  assert.ok(inScope('EMT-I', 'PARAMEDIC'));
});
