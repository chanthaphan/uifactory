import test from 'node:test';
import assert from 'node:assert/strict';
import { redactConfig } from '../src/common/redact.util';

test('masks secret-bearing top-level keys, preserving a prefix/suffix hint', () => {
  const out = redactConfig({ connectionString: 'postgres://user:pass@host/db', apiKey: 'abcdefgh' });
  assert.ok((out.connectionString as string).includes('***'));
  assert.ok((out.connectionString as string).startsWith('pos'));
  assert.equal(out.apiKey, 'abc***gh');
});

test('short secrets collapse to ***; non-secret keys are untouched', () => {
  assert.equal(redactConfig({ token: 'abc' }).token, '***');
  assert.equal(redactConfig({ baseUrl: 'https://x.io' }).baseUrl, 'https://x.io');
});

test('masks Authorization / key / token headers only', () => {
  const out = redactConfig({ headers: { Authorization: 'Bearer xyz', 'X-Api-Key': 'k', 'X-Trace': 't' } });
  assert.deepEqual(out.headers, { Authorization: '***', 'X-Api-Key': '***', 'X-Trace': 't' });
});
