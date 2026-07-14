import { stepAccrual, COSTED_STAGES } from '../components/cinnamon/cinnamonUtils.js';

/**
 * Find batches at risk of double-counted transport.
 *
 * Two different costs exist, and they are meant to be different:
 *
 *   Batch  `freight_amount`  — inbound freight, supplier to factory. Feeds
 *                              landed_cost_per_kg, which the packaging roll-up
 *                              already includes as landedCostBase.
 *   Step   `transport_cost`  — transport incurred during processing.
 *
 * Until now transport could only be entered on the CUTTING stage, so anyone
 * needing to record haulage into pre-processing had to put it somewhere else —
 * usually batch freight. Now that transport is capturable on every stage, the same
 * haulage could end up recorded in BOTH places and counted twice.
 *
 * This cannot be decided automatically: only a human knows whether a given lorry
 * load was booked once or twice. So the rule here is deliberately conservative —
 * flag every batch carrying BOTH inbound freight and step transport, and report
 * the numbers. Nothing is changed.
 */

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, dp = 2) => {
  const factor = 10 ** dp;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const auditBatchTransport = ({ batches = [], steps = [] } = {}) => {
  const stepsByBatch = new Map();
  for (const step of steps) {
    const key = step?.batch_number;
    if (!key) continue;
    if (!stepsByBatch.has(key)) stepsByBatch.set(key, []);
    stepsByBatch.get(key).push(step);
  }

  const flagged = [];
  const clean = [];

  for (const batch of batches) {
    const batchSteps = stepsByBatch.get(batch.batch_number) || [];

    const inboundFreight = num(batch.freight_amount);

    // Only stages that are actually costed can contribute — grading/packaging are
    // costed elsewhere and must not be counted here.
    const costedSteps = batchSteps.filter((s) => COSTED_STAGES.includes(s?.stage));

    const stepTransport = round(
      costedSteps.reduce((sum, s) => sum + num(s.transport_cost), 0)
    );

    const transportSteps = costedSteps
      .filter((s) => num(s.transport_cost) > 0)
      .map((s) => ({
        id: s.id,
        stage: s.stage,
        transport_cost: num(s.transport_cost),
      }));

    const row = {
      id: batch.id,
      batch_number: batch.batch_number,
      supplier: batch.supplier,
      inboundFreight: round(inboundFreight),
      stepTransport,
      transportSteps,
      totalTransport: round(inboundFreight + stepTransport),
      processCost: round(costedSteps.reduce((sum, s) => sum + stepAccrual(s), 0)),
    };

    // Both populated => the same haulage may have been entered twice.
    if (inboundFreight > 0 && stepTransport > 0) flagged.push(row);
    else clean.push(row);
  }

  return {
    flagged,
    clean,
    totals: {
      batches: batches.length,
      flaggedCount: flagged.length,
      inboundFreight: round(flagged.reduce((s, r) => s + r.inboundFreight, 0)),
      stepTransport: round(flagged.reduce((s, r) => s + r.stepTransport, 0)),
      atRisk: round(flagged.reduce((s, r) => s + Math.min(r.inboundFreight, r.stepTransport), 0)),
    },
  };
};
