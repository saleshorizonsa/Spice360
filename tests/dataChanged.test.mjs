import test from 'node:test';
import assert from 'node:assert/strict';
import {
  onDataChanged,
  notifyDataChanged,
  withChangeNotifications,
  createDebouncedTrigger,
} from '../src/lib/dataChanged.js';

// A stand-in for matrixSales.entities: a Proxy-like map of entity clients.
const fakeEntities = () => {
  const make = () => ({
    list: async () => [{ id: 1 }],
    filter: async () => [{ id: 2 }],
    create: async (data) => ({ id: 'new', ...data }),
    bulkCreate: async (rows) => rows.map((r, i) => ({ id: i, ...r })),
    update: async (id, data) => ({ id, ...data }),
    delete: async (id) => ({ id, deleted: true }),
    failingCreate: undefined,
  });
  return new Proxy({}, { get: () => make() });
};

test('every write method announces the entity it wrote, after it succeeds', async () => {
  const seen = [];
  const entities = withChangeNotifications(fakeEntities(), (name) => seen.push(name));

  await entities.Invoice.create({ total: 1 });
  await entities.JournalLine.bulkCreate([{ debit: 1 }]);
  await entities.StockLevel.update('s1', { quantity: 3 });
  await entities.Payment.delete('p1');

  assert.deepEqual(seen, ['Invoice', 'JournalLine', 'StockLevel', 'Payment']);
});

test('reads never announce anything', async () => {
  const seen = [];
  const entities = withChangeNotifications(fakeEntities(), (name) => seen.push(name));
  await entities.Invoice.list();
  await entities.Invoice.filter({ status: 'draft' });
  assert.deepEqual(seen, []);
});

test('a write passes its arguments through and returns its own result', async () => {
  const entities = withChangeNotifications(fakeEntities(), () => {});
  const created = await entities.Invoice.create({ invoice_number: 'INV-1' });
  assert.deepEqual(created, { id: 'new', invoice_number: 'INV-1' });
  const updated = await entities.Invoice.update('x', { status: 'paid' });
  assert.deepEqual(updated, { id: 'x', status: 'paid' });
});

test('a write that fails announces nothing and still throws', async () => {
  const seen = [];
  const broken = new Proxy({}, {
    get: () => ({ create: async () => { throw new Error('RLS violation'); } }),
  });
  const entities = withChangeNotifications(broken, (name) => seen.push(name));
  await assert.rejects(() => entities.Invoice.create({}), /RLS violation/);
  assert.deepEqual(seen, [], 'nothing new to show');
});

test('a broken listener never turns a successful save into a failure', async () => {
  const off = onDataChanged(() => { throw new Error('refresh blew up'); });
  const received = [];
  const offGood = onDataChanged((name) => received.push(name));
  try {
    assert.doesNotThrow(() => notifyDataChanged('Invoice'));
    assert.deepEqual(received, ['Invoice'], 'other listeners still run');
  } finally {
    off();
    offGood();
  }
});

test('unsubscribing stops further notifications', () => {
  const received = [];
  const off = onDataChanged((name) => received.push(name));
  notifyDataChanged('A');
  off();
  notifyDataChanged('B');
  assert.deepEqual(received, ['A']);
});

test('a burst of writes collapses into a single refresh', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let refreshes = 0;
  const trigger = createDebouncedTrigger(() => { refreshes++; }, 500);

  // One posting: journal header, three lines, stock update, AR update — six writes
  // 100ms apart, the last at t=500.
  for (let i = 0; i < 6; i++) {
    if (i > 0) t.mock.timers.tick(100);
    trigger();
  }
  assert.equal(refreshes, 0, 'nothing fires while writes keep arriving');

  t.mock.timers.tick(499);
  assert.equal(refreshes, 0, 'still quiet 499ms after the last write');
  t.mock.timers.tick(1);
  assert.equal(refreshes, 1, 'exactly one refresh, 500ms after the burst ends');
});

test('writes separated by a pause refresh separately', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let refreshes = 0;
  const trigger = createDebouncedTrigger(() => { refreshes++; }, 500);

  trigger();
  t.mock.timers.tick(600);
  trigger();
  t.mock.timers.tick(600);
  assert.equal(refreshes, 2);
});
