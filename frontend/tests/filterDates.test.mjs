import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTimeRange, toUtcInstant } from '../src/api/filterDates.ts';
import { fetchEvents } from '../src/api/events.ts';

test('converts UTC input without applying the computer timezone', () => {
  assert.equal(toUtcInstant('2026-09-20T14:02', 'From'), '2026-09-20T14:02:00.000Z');
  assert.equal(toUtcInstant('2026-09-20T14:02:03.1', 'To'), '2026-09-20T14:02:03.100Z');
});

test('allows omitted, one-sided, and equal inclusive bounds', () => {
  assert.deepEqual(getTimeRange('', ''), { from: '', to: '' });
  assert.equal(getTimeRange('2026-09-20T14:02', '').to, '');
  assert.equal(getTimeRange('', '2026-09-20T14:02').from, '');
  const range = getTimeRange('2026-09-20T14:02', '2026-09-20T14:02');
  assert.equal(range.from, range.to);
});

test('rejects reversed ranges', () => {
  assert.throws(() => getTimeRange('2026-09-20T14:03', '2026-09-20T14:02'), /From must be at or before To/);
});

test('rejects malformed and impossible dates, but accepts leap days', () => {
  for (const value of ['bad', '2026-02-30T12:00', '2026-02-29T12:00', '2026-09-20T25:00', '0000-01-01T00:00']) {
    assert.throws(() => toUtcInstant(value, 'From'), /valid UTC date and time/);
  }
  assert.equal(toUtcInstant('2028-02-29T12:00', 'From'), '2028-02-29T12:00:00.000Z');
});

test('API requests retain page, source, and exact UTC bounds; blank filters are omitted', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url: new URL(url, 'http://localhost'), signal: options.signal });
    return new Response(JSON.stringify({ content: [] }), { status: 200 });
  });
  const signal = new AbortController().signal;
  const from = '2026-09-20T14:02:03.000Z';
  await fetchEvents(1, 'payment-service', from, from, signal);
  assert.deepEqual(Object.fromEntries(requests[0].url.searchParams), { page: '1', size: '20', source: 'payment-service', from, to: from });
  assert.equal(requests[0].signal, signal);
  await fetchEvents(0, '', '', '', signal);
  assert.deepEqual(Object.fromEntries(requests[1].url.searchParams), { page: '0', size: '20' });
});
