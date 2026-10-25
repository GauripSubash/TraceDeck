import type { EventContext, EventPage } from '../types';

export async function fetchEvents(pageNumber: number, source: string, from: string, to: string, signal: AbortSignal): Promise<EventPage> {
  const parameters = new URLSearchParams({ page: String(pageNumber), size: '20' });
  // An omitted source means all services; an empty source parameter is invalid.
  if (source !== '') parameters.set('source', source);
  if (from !== '') parameters.set('from', from);
  if (to !== '') parameters.set('to', to);
  const response = await fetch(`/api/events?${parameters.toString()}`, { signal });

  // fetch rejects network failures, but HTTP errors need an explicit check.
  if (!response.ok) {
    throw new Error(`The events request failed (HTTP ${response.status}). Check that Spring Boot is running on port 8080, then retry.`);
  }

  // TypeScript describes the expected JSON; it does not validate it at runtime.
  return response.json();
}

export async function fetchEventContext(eventId: string, signal: AbortSignal): Promise<EventContext> {
  // Context includes other services and is independent of the table's filters.
  const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/context?limit=5`, { signal });
  if (response.status === 404) {
    throw new Error('This event could not be found. Close the investigation and refresh the event table.');
  }
  if (!response.ok) {
    throw new Error(`The investigation request failed (HTTP ${response.status}). Check that Spring Boot is running on port 8080, then retry.`);
  }
  return response.json();
}
