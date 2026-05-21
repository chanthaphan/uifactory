import test from 'node:test';
import assert from 'node:assert/strict';
import { collectQueryIds, normalizeDefinition, remapDataSourceIds, remapQueryIds } from '../src/apps/app-defs';
import type { AppDefinition } from '../src/apps/app-defs';

const def: AppDefinition = {
  pages: [
    { id: 'p1', name: 'Home', slug: 'home', type: 'ui', queryId: 'q1', dataSourceIds: ['d1', 'd2'], actions: [{ name: 'a', queryId: 'q3' }] },
    { id: 'p2', name: 'Chat', slug: 'chat', type: 'chat', chat: { queryId: 'q2' } },
  ],
};

test('collectQueryIds gathers page, chat and action query ids', () => {
  assert.deepEqual(collectQueryIds(def).sort(), ['q1', 'q2', 'q3']);
});

test('remapQueryIds remaps known ids and keeps unmapped ones', () => {
  const out = remapQueryIds(def, { q1: 'X1', q3: 'X3' });
  assert.equal(out.pages[0].queryId, 'X1');
  assert.equal(out.pages[0].actions?.[0].queryId, 'X3');
  assert.equal(out.pages[1].chat?.queryId, 'q2'); // unmapped, unchanged
});

test('remapDataSourceIds remaps and drops unmapped scope ids', () => {
  const out = remapDataSourceIds(def, { d1: 'N1' });
  assert.deepEqual(out.pages[0].dataSourceIds, ['N1']); // d2 had no mapping → dropped
});

test('normalizeDefinition coerces a legacy single-html app into one page', () => {
  const norm = normalizeDefinition({ html: '<p>hi</p>', queryId: 'q9' });
  assert.equal(norm.pages.length, 1);
  assert.equal(norm.pages[0].type, 'ui');
  assert.equal(norm.pages[0].html, '<p>hi</p>');
  assert.deepEqual(normalizeDefinition({}).pages, []);
});
