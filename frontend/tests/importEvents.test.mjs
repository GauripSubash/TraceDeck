import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventImportError, importEvents, parseEventFile } from '../src/api/importEvents.ts';

test('parses the downloadable four-event sample and accepts a UTF-8 BOM', async () => {
  const text = await readFile(new URL('../public/sample-trace.json', import.meta.url), 'utf8');
  const events = parseEventFile('\uFEFF' + text);
  assert.equal(events.length, 4);
  assert.equal(events[0].requestId, events[3].requestId);
  assert.equal(events[3].eventType, 'CHECKOUT_FAILED');
});

test('rejects malformed JSON, nonarrays, empty batches, and oversized batches before posting', () => {
  assert.throws(() => parseEventFile('[broken]'), /not valid JSON/);
  for (const value of [null, {}, [], Array(501).fill({})]) {
    assert.throws(() => parseEventFile(JSON.stringify(value)), /1–500 events/);
  }
  assert.equal(parseEventFile(JSON.stringify(Array(500).fill({}))).length, 500);
});

test('POST sends JSON content type, batch body, and abort signal and returns import IDs', async t => {
  const events = [{ requestId: 'req-import' }];
  const signal = new AbortController().signal;
  const result = { imported: 1, message: 'Events imported successfully', eventIds: ['event-id'] };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/events/import');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), events);
    assert.equal(options.signal, signal);
    return new Response(JSON.stringify(result), { status: 201 });
  });
  assert.deepEqual(await importEvents(events, signal), result);
});

test('backend validation errors retain indexed fields for the user', async t => {
  const errors = [{ field: 'events[1].source', message: 'must not be blank' }];
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ errors }), { status: 400 }));
  await assert.rejects(importEvents([{}], new AbortController().signal), error => {
    assert.ok(error instanceof EventImportError);
    assert.deepEqual(error.fieldErrors, errors);
    assert.match(error.message, /No events were saved/);
    return true;
  });
});

test('network and HTTP failures explain uncertain outcomes instead of suggesting blind retries', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('network failure'); });
  await assert.rejects(importEvents([{}], new AbortController().signal), /refresh the table before retrying/i);
  mock.mock.mockImplementation(async () => new Response(null, { status: 502 }));
  await assert.rejects(importEvents([{}], new AbortController().signal), /HTTP 502/);
});
