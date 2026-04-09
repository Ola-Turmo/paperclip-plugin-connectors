import test from 'node:test';
import assert from 'node:assert/strict';
import { repoId, responsibility } from '../src/index.mjs';

test('repo smoke', () => {
  assert.equal(repoId, '@uos/plugin-connectors');
  assert.ok(responsibility.length > 5);
});
