// Accrual amount per processing step — mirrors CinnamonProcessStepForm's GL posting logic.
// Cutting: step_total_cost (5 cost fields + contract labour)
// Pre-processing / rubbing_peeling: labour_cost_total (contract labour only)
// Grading / moisture_qc / packaging: no accrual (separate costing)
export const stepAccrual = (s) =>
    s.stage === "cutting"
        ? parseFloat(s.step_total_cost)  || 0
        : ["pre_processing", "rubbing_peeling"].includes(s.stage)
            ? parseFloat(s.labour_cost_total) || 0
            : 0;
