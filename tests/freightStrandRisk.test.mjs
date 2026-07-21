import assert from 'node:assert/strict';
import test from 'node:test';
import { assessFreightStrand } from '../src/lib/freightStrandRisk.js';

const grns = [
  { grn_number: 'GRN-1', material_code: 'CIN-001', receiving_location: 'WH1', quantity_received: 100 },
  { grn_number: 'GRN-2', material_code: 'CIN-002', receiving_location: 'WH1', quantity_received: 50 },
];

test('no strand risk when the goods are still fully on hand', () => {
  const stockLevels = [
    { material_code: 'CIN-001', warehouse_code: 'WH1', quantity: 100 },
    { material_code: 'CIN-002', warehouse_code: 'WH1', quantity: 50 },
  ];
  const r = assessFreightStrand({ linkedGRNs: [{ grn_number: 'GRN-1', grn_quantity: 100 }], grns, stockLevels });
  assert.equal(r.atRisk, false);
  assert.equal(r.onHandQty, 100);
});

test('flags strand risk when the goods have been sold (nothing on hand)', () => {
  const stockLevels = [{ material_code: 'CIN-001', warehouse_code: 'WH1', quantity: 0 }];
  const r = assessFreightStrand({ linkedGRNs: [{ grn_number: 'GRN-1', grn_quantity: 100 }], grns, stockLevels });
  assert.equal(r.atRisk, true);
  assert.equal(r.soldQty, 100);
});

test('flags partial strand risk when only some stock remains', () => {
  const stockLevels = [{ material_code: 'CIN-001', warehouse_code: 'WH1', quantity: 40 }]; // received 100, 60 sold
  const r = assessFreightStrand({ linkedGRNs: [{ grn_number: 'GRN-1', grn_quantity: 100 }], grns, stockLevels });
  assert.equal(r.atRisk, true);
  assert.equal(r.onHandQty, 40);
  assert.equal(r.soldQty, 60);
});

test('flags risk if ANY linked position is short, even when another is full', () => {
  const stockLevels = [
    { material_code: 'CIN-001', warehouse_code: 'WH1', quantity: 100 }, // full
    { material_code: 'CIN-002', warehouse_code: 'WH1', quantity: 0 },   // sold
  ];
  const r = assessFreightStrand({
    linkedGRNs: [{ grn_number: 'GRN-1', grn_quantity: 100 }, { grn_number: 'GRN-2', grn_quantity: 50 }],
    grns, stockLevels,
  });
  assert.equal(r.atRisk, true);
  assert.equal(r.atRiskPositions, 1);
});

test('no linked GRNs or no stock data does not crash', () => {
  assert.equal(assessFreightStrand({}).atRisk, false);
  assert.equal(assessFreightStrand({ linkedGRNs: [{ grn_number: 'GRN-1', grn_quantity: 100 }], grns, stockLevels: [] }).atRisk, true);
});
