import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchEventContext } from '../src/api/events.ts';

test('context request uses the selected ID, five-event limit, and cancellation signal without table filters', async t => {
  const context = { selectedEvent: { id: 'selected' }, precedingEvents: [], requestId: 'req-test', probableCause: null, eventCount: 1 };
  const signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/events/selected/context?limit=5');
    assert.equal(options.signal, signal);
    return new Response(JSON.stringify(context));
  });
  assert.deepEqual(await fetchEventContext('selected', signal), context);
});

test('unknown events get a useful recovery message', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 404 }));
  await assert.rejects(fetchEventContext('missing', new AbortController().signal), /Close the investigation and refresh/);
});

test('context HTTP failures are surfaced for retry', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 502 }));
  await assert.rejects(fetchEventContext('selected', new AbortController().signal), /HTTP 502/);
});

test('context cancellation propagates without converting it into a success', async t => {
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    signal.throwIfAborted();
  });
  await assert.rejects(fetchEventContext('selected', controller.signal), { name: 'AbortError' });
});
