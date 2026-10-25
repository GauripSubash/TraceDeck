import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildDemoEvents } from '../../data/generate-events.mjs';

const canonical = await readFile(new URL('../../data/events.json', import.meta.url), 'utf8');
const events = JSON.parse(canonical);

test('fixture is reproducible and the frontend download matches the canonical dataset', async () => {
  assert.equal(canonical, JSON.stringify(buildDemoEvents(), null, 2) + '\n');
  assert.equal(await readFile(new URL('../public/demo-events.json', import.meta.url), 'utf8'), canonical);
});

test('100 events form 20 ordered five-event traces across the four planned services', () => {
  assert.equal(events.length, 100);
  assert.deepEqual([...new Set(events.map(event => event.source))].sort(), ['auth-service', 'checkout-service', 'payment-service', 'web-gateway']);
  const traces = new Map();
  for (const event of events) {
    if (!traces.has(event.requestId)) traces.set(event.requestId, []);
    traces.get(event.requestId).push(event);
  }
  assert.equal(traces.size, 20);
  for (const trace of traces.values()) {
    assert.equal(trace.length, 5);
    for (let index = 1; index < trace.length; index++) {
      assert.ok(Date.parse(trace[index].occurredAt) > Date.parse(trace[index - 1].occurredAt));
    }
  }
});

test('six known failure traces have expected first warnings; fourteen traces succeed', () => {
  const expected = new Map([
    ['req-demo-1003', 'TOKEN_EXPIRING'], ['req-demo-1006', 'CART_ITEM_UNAVAILABLE'],
    ['req-demo-1009', 'PAYMENT_PROVIDER_SLOW'], ['req-demo-1012', 'POSTAL_CODE_UNSUPPORTED'],
    ['req-demo-1015', 'DB_POOL_EXHAUSTED'], ['req-demo-1018', 'PAYMENT_RISK_REVIEW'],
  ]);
  let failed = 0;
  let succeeded = 0;
  for (let number = 1001; number <= 1020; number++) {
    const requestId = `req-demo-${number}`;
    const trace = events.filter(event => event.requestId === requestId);
    if (expected.has(requestId)) {
      failed++;
      assert.equal(trace.find(event => event.level !== 'INFO').eventType, expected.get(requestId));
      assert.equal(trace[4].level, 'ERROR');
    } else {
      succeeded++;
      assert.ok(trace.every(event => event.level === 'INFO'));
      assert.equal(trace[4].eventType, 'CHECKOUT_COMPLETED');
    }
  }
  assert.equal(failed, 6);
  assert.equal(succeeded, 14);
});

test('fixture respects import constraints and details are synthetic JSON text', () => {
  const lengths = { source: 50, eventType: 60, message: 255, requestId: 40 };
  for (const event of events) {
    for (const [field, maxLength] of Object.entries(lengths)) {
      assert.equal(typeof event[field], 'string');
      assert.ok(event[field].trim().length > 0 && event[field].length <= maxLength);
    }
    assert.ok(['INFO', 'WARN', 'ERROR'].includes(event.level));
    assert.ok(Number.isFinite(Date.parse(event.occurredAt)));
    assert.ok(event.statusCode === null || (Number.isInteger(event.statusCode) && event.statusCode >= 100 && event.statusCode <= 599));
    assert.ok(Number.isInteger(event.durationMs) && event.durationMs >= 0);
    assert.equal(JSON.parse(event.details).synthetic, true);
    assert.equal('id' in event, false);
  }
});
