// Cost of a processing step. Single source of truth — the packaging roll-up, the
// batch trace and the accrual clearing dialog all read this, so they cannot drift.
//
// `step_total_cost` already embeds the step's contract labour (labour_cost_total),
// so it must never be added on top.
//
// Costs used to be capturable on the CUTTING stage only: pre-processing and
// rubbing/peeling could record contract labour but not transport, packaging,
// electricity or other labour, and step_total_cost was hard-zeroed for them.
// Transport hauling raw bark in is a real pre-processing cost, so every stage now
// carries the full cost set.
//
// BACKWARD COMPATIBILITY: steps saved under the old behaviour have
// step_total_cost = 0 with a real labour_cost_total. Falling back to
// labour_cost_total keeps their cost intact — reading step_total_cost alone would
// silently wipe the labour off every historical pre-processing and peeling step.
const COSTED_STAGES = ['pre_processing', 'rubbing_peeling', 'cutting'];

export const stepAccrual = (s) => {
    if (!COSTED_STAGES.includes(s?.stage)) return 0; // grading/packaging are costed separately

    const total = parseFloat(s?.step_total_cost) || 0;
    if (total > 0) return total;

    return parseFloat(s?.labour_cost_total) || 0; // legacy row written before all-stage costing
};

export { COSTED_STAGES };
