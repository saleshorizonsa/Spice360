import assert from 'node:assert/strict';
import test from 'node:test';
import { isPostableAccount } from '../src/lib/accountStatus.js';

// Regression: the GL Account Mapping and Journal Entry screens queried accounts
// with `.filter({ status: 'active' })`. `status` is a metadata column, so that
// became a strict SQL eq('status','active') against a generated column — any
// account saved as "Active", or with a blank/absent status, matched nothing and
// vanished from every dropdown as "No results found", despite being listed on
// the Chart of Accounts page.
test('an account is postable unless explicitly disabled', () => {
  // These all used to be invisible.
  assert.equal(isPostableAccount({ status: 'active' }), true);
  assert.equal(isPostableAccount({ status: 'Active' }), true);
  assert.equal(isPostableAccount({ status: 'ACTIVE' }), true);
  assert.equal(isPostableAccount({ status: ' active ' }), true);
  assert.equal(isPostableAccount({ status: '' }), true);
  assert.equal(isPostableAccount({}), true);
  assert.equal(isPostableAccount({ status: null }), true);
  assert.equal(isPostableAccount(), true);
});

test('explicitly disabled accounts stay hidden', () => {
  assert.equal(isPostableAccount({ status: 'inactive' }), false);
  assert.equal(isPostableAccount({ status: 'Inactive' }), false);
  assert.equal(isPostableAccount({ status: 'archived' }), false);
  assert.equal(isPostableAccount({ status: 'closed' }), false);
  assert.equal(isPostableAccount({ status: 'blocked' }), false);
  assert.equal(isPostableAccount({ status: 'disabled' }), false);
});
