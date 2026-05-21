import test from 'node:test';
import assert from 'node:assert/strict';
import { dataSourceInScope, isMutationConfig } from '../src/common/query-config.util';

test('isMutationConfig detects writes for SQL and REST', () => {
  assert.equal(isMutationConfig({ sql: 'SELECT * FROM t' }), false);
  assert.equal(isMutationConfig({ sql: '  with cte as (select 1) select *' }), false);
  assert.equal(isMutationConfig({ sql: 'INSERT INTO t VALUES (1)' }), true);
  assert.equal(isMutationConfig({ sql: 'delete from t' }), true);
  assert.equal(isMutationConfig({ method: 'GET' }), false);
  assert.equal(isMutationConfig({ method: 'post' }), true);
  assert.equal(isMutationConfig({}), false); // defaults to GET
});

test('dataSourceInScope: empty/undefined scope allows all', () => {
  assert.equal(dataSourceInScope(undefined, 'a'), true);
  assert.equal(dataSourceInScope([], 'a'), true);
  assert.equal(dataSourceInScope(['a', 'b'], 'a'), true);
  assert.equal(dataSourceInScope(['a'], 'b'), false);
  assert.equal(dataSourceInScope(['a'], undefined), false);
});
