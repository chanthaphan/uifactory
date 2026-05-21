import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDataSourceConfig } from '../src/datasources/config-validation';

test('REST requires a valid baseUrl', () => {
  assert.equal(validateDataSourceConfig('REST', { baseUrl: 'https://api.example.com' }), null);
  assert.ok(validateDataSourceConfig('REST', {})); // missing
  assert.ok(validateDataSourceConfig('REST', { baseUrl: 'not a url' }));
});

test('POSTGRES requires a connection string; masked value passes', () => {
  assert.equal(validateDataSourceConfig('POSTGRES', { connectionString: 'postgres://u:p@h:5432/db' }), null);
  assert.equal(validateDataSourceConfig('POSTGRES', { connectionString: 'pos***db' }), null); // masked, still non-empty
  assert.ok(validateDataSourceConfig('POSTGRES', { connectionString: '' }));
  assert.ok(validateDataSourceConfig('POSTGRES', {}));
});

test('SQLITE requires a file; MSGRAPH needs no config', () => {
  assert.equal(validateDataSourceConfig('SQLITE', { file: '/tmp/x.db' }), null);
  assert.ok(validateDataSourceConfig('SQLITE', { file: '' }));
  assert.equal(validateDataSourceConfig('MSGRAPH', {}), null);
});

test('AGENT requires a url; unknown extra keys are allowed', () => {
  assert.equal(validateDataSourceConfig('AGENT', { url: 'https://agent.example.com', apiKey: 'k' }), null);
  assert.ok(validateDataSourceConfig('AGENT', { apiKey: 'k' })); // no url
  assert.equal(validateDataSourceConfig('REST', { baseUrl: 'https://x.io', somethingExtra: 1 }), null);
});
