import assert from 'node:assert/strict';
import test from 'node:test';
import { findBlockingVendorInvoices } from '../src/lib/grnReversal.js';

test('finds a vendor invoice referencing the GRN via grn_references array', () => {
  const invoices = [
    { vendor_invoice_number: 'VI-1', status: 'approved', grn_references: [{ grn_number: 'GRN-1' }] },
    { vendor_invoice_number: 'VI-2', status: 'approved', grn_references: [{ grn_number: 'GRN-9' }] },
  ];
  const blocking = findBlockingVendorInvoices('GRN-1', invoices);
  assert.equal(blocking.length, 1);
  assert.equal(blocking[0].vendor_invoice_number, 'VI-1');
});

test('finds via a comma-joined legacy grn_number', () => {
  const invoices = [{ vendor_invoice_number: 'VI-1', status: 'pending_match', grn_number: 'GRN-1, GRN-2' }];
  assert.equal(findBlockingVendorInvoices('GRN-2', invoices).length, 1);
});

test('handles grn_references stored as a JSON string', () => {
  const invoices = [{ vendor_invoice_number: 'VI-1', status: 'approved', grn_references: '[{"grn_number":"GRN-5"}]' }];
  assert.equal(findBlockingVendorInvoices('GRN-5', invoices).length, 1);
});

test('a cancelled invoice does not block', () => {
  const invoices = [{ vendor_invoice_number: 'VI-1', status: 'cancelled', grn_references: [{ grn_number: 'GRN-1' }] }];
  assert.equal(findBlockingVendorInvoices('GRN-1', invoices).length, 0);
});

test('no invoice referencing the GRN means no block', () => {
  assert.equal(findBlockingVendorInvoices('GRN-1', [{ vendor_invoice_number: 'VI-1', grn_number: 'GRN-2' }]).length, 0);
  assert.equal(findBlockingVendorInvoices('GRN-1', []).length, 0);
  assert.equal(findBlockingVendorInvoices('', []).length, 0);
});
