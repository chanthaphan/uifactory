import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfigPreservingSecrets } from '../src/common/secret-merge.util';

test('keeps stored secret when incoming is masked or blank', () => {
  assert.deepEqual(
    mergeConfigPreservingSecrets({ connectionString: 'real-secret', baseUrl: 'a' }, { connectionString: 'rea***et', baseUrl: 'b' }),
    { connectionString: 'real-secret', baseUrl: 'b' },
  );
  assert.deepEqual(
    mergeConfigPreservingSecrets({ connectionString: 'real-secret' }, { connectionString: '' }),
    { connectionString: 'real-secret' },
  );
});

test('overwrites with a freshly typed secret and adds new keys', () => {
  assert.deepEqual(
    mergeConfigPreservingSecrets({ connectionString: 'old' }, { connectionString: 'new-secret' }),
    { connectionString: 'new-secret' },
  );
  assert.deepEqual(mergeConfigPreservingSecrets({ a: '1' }, { a: '1', b: '2' }), { a: '1', b: '2' });
});

test('merges headers per key, preserving masked header values', () => {
  const merged = mergeConfigPreservingSecrets(
    { headers: { Authorization: 'real-token', X: '1' } },
    { headers: { Authorization: '***', X: '2', Y: '3' } },
  );
  assert.deepEqual(merged.headers, { Authorization: 'real-token', X: '2', Y: '3' });
});
