import assert from 'node:assert/strict';
import test from 'node:test';
import { stepAccrual, COSTED_STAGES } from '../src/components/cinnamon/cinnamonUtils.js';

// Costs (transport, electricity, materials, labour) used to be capturable on the
// CUTTING stage only. On pre-processing and rubbing/peeling the fields were not
// even rendered and step_total_cost was hard-zeroed, so transport hauling raw bark
// in had nowhere to go. Every stage now carries the full cost set.

test('transport now counts on pre-processing, not just cutting', () => {
  // step_total_cost = 5 cost fields + contract labour, computed for ANY stage.
  const preProcessing = { stage: 'pre_processing', step_total_cost: 50000, labour_cost_total: 20000 };
  assert.equal(stepAccrual(preProcessing), 50000); // previously would have been 20000
});

test('transport counts on rubbing & peeling', () => {
  const peeling = { stage: 'rubbing_peeling', step_total_cost: 12500, labour_cost_total: 2500 };
  assert.equal(stepAccrual(peeling), 12500);
});

test('cutting is unchanged', () => {
  const cutting = { stage: 'cutting', step_total_cost: 90000, labour_cost_total: 30000 };
  assert.equal(stepAccrual(cutting), 90000);
});

// ── The dangerous part: legacy rows ─────────────────────────────────────────
// Steps saved under the old behaviour have step_total_cost = 0 with a real
// labour_cost_total. Reading step_total_cost alone would silently wipe the labour
// cost off every historical pre-processing and peeling step.
test('a legacy pre-processing row keeps its labour cost', () => {
  const legacy = { stage: 'pre_processing', step_total_cost: 0, labour_cost_total: 18000 };
  assert.equal(stepAccrual(legacy), 18000);
});

test('a legacy row with the field absent entirely keeps its labour cost', () => {
  const legacy = { stage: 'rubbing_peeling', labour_cost_total: 7000 };
  assert.equal(stepAccrual(legacy), 7000);
});

test('a new row supersedes the fallback — labour is never double counted', () => {
  // step_total_cost already embeds labour_cost_total, so it must be used alone.
  const fresh = { stage: 'pre_processing', step_total_cost: 25000, labour_cost_total: 10000 };
  assert.equal(stepAccrual(fresh), 25000); // not 35000
});

// ── Stages costed elsewhere must stay at zero (no double counting) ──────────
test('grading and packaging accrue nothing here — they are costed separately', () => {
  assert.equal(stepAccrual({ stage: 'grading', step_total_cost: 5000, labour_cost_total: 5000 }), 0);
  assert.equal(stepAccrual({ stage: 'packaging', step_total_cost: 5000 }), 0);
  assert.equal(stepAccrual({ stage: 'completed', step_total_cost: 5000 }), 0);
});

test('handles missing/garbage input without throwing', () => {
  assert.equal(stepAccrual({}), 0);
  assert.equal(stepAccrual(undefined), 0);
  assert.equal(stepAccrual({ stage: 'cutting', step_total_cost: 'abc' }), 0);
});

test('the costed stages are exactly the ones the step form offers', () => {
  assert.deepEqual([...COSTED_STAGES].sort(), ['cutting', 'pre_processing', 'rubbing_peeling']);
});
