import assert from 'node:assert/strict';
import test from 'node:test';
import { auditBatchTransport } from '../src/lib/cinnamonCostAudit.js';

const batch = (n, freight) => ({ id: n, batch_number: n, supplier: 'S', freight_amount: freight });
const step = (batchNo, stage, transport, labour = 0) => ({
  id: `${batchNo}-${stage}`, batch_number: batchNo, stage,
  transport_cost: transport, step_total_cost: transport + labour, labour_cost_total: labour,
});

test('flags a batch carrying BOTH inbound freight and step transport', () => {
  const { flagged, totals } = auditBatchTransport({
    batches: [batch('B1', 30000)],
    steps: [step('B1', 'pre_processing', 25000)],
  });
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].inboundFreight, 30000);
  assert.equal(flagged[0].stepTransport, 25000);
  assert.equal(flagged[0].transportSteps[0].stage, 'pre_processing');
  // The exposure is the smaller of the two — that is the most that could be a duplicate.
  assert.equal(totals.atRisk, 25000);
});

test('a batch with freight only is not flagged', () => {
  const { flagged, clean } = auditBatchTransport({
    batches: [batch('B2', 30000)],
    steps: [step('B2', 'cutting', 0, 5000)],
  });
  assert.equal(flagged.length, 0);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].inboundFreight, 30000);
  assert.equal(clean[0].stepTransport, 0);
});

test('a batch with step transport only is not flagged', () => {
  const { flagged, clean } = auditBatchTransport({
    batches: [batch('B3', 0)],
    steps: [step('B3', 'pre_processing', 12000)],
  });
  assert.equal(flagged.length, 0);
  assert.equal(clean[0].stepTransport, 12000);
});

test('sums transport across several stages of the same batch', () => {
  const { flagged } = auditBatchTransport({
    batches: [batch('B4', 10000)],
    steps: [
      step('B4', 'pre_processing', 5000),
      step('B4', 'rubbing_peeling', 3000),
      step('B4', 'cutting', 2000),
    ],
  });
  assert.equal(flagged[0].stepTransport, 10000);
  assert.equal(flagged[0].transportSteps.length, 3);
  assert.equal(flagged[0].totalTransport, 20000);
});

test('ignores stages costed elsewhere (grading/packaging)', () => {
  // A transport value on a grading step must not count — grading is costed separately.
  const { flagged, clean } = auditBatchTransport({
    batches: [batch('B5', 10000)],
    steps: [{ id: 'x', batch_number: 'B5', stage: 'grading', transport_cost: 9999 }],
  });
  assert.equal(flagged.length, 0);
  assert.equal(clean[0].stepTransport, 0);
});

test('handles batches with no steps and empty input', () => {
  const { flagged, clean, totals } = auditBatchTransport({ batches: [batch('B6', 500)], steps: [] });
  assert.equal(flagged.length, 0);
  assert.equal(clean[0].stepTransport, 0);
  assert.equal(totals.batches, 1);
  assert.deepEqual(auditBatchTransport({}).flagged, []);
});
