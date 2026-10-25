import type { ImportResult } from '../types';

export interface ImportFieldError {
  field: string;
  message: string;
}

export class EventImportError extends Error {
  fieldErrors: ImportFieldError[];

  constructor(message: string, fieldErrors: ImportFieldError[] = []) {
    super(message);
    this.name = 'EventImportError';
    this.fieldErrors = fieldErrors;
  }
}

export function parseEventFile(text: string): unknown[] {
  let events: unknown;
  try {
    events = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new EventImportError('The file is not valid JSON. Check its commas, brackets, and quotation marks.');
  }
  if (!Array.isArray(events) || events.length < 1 || events.length > 500) {
    throw new EventImportError('The file must contain a JSON array of 1–500 events.');
  }
  // Spring validates individual fields and rejects an invalid batch atomically.
  return events;
}

export async function importEvents(events: unknown[], signal: AbortSignal): Promise<ImportResult> {
  let response: Response;
  try {
    response = await fetch('/api/events/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(events),
      signal,
    });
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new EventImportError('Could not confirm the import. Check the connection and refresh the table before retrying; repeating an import can create duplicates.');
  }

  if (response.status === 400) {
    const problem = await response.json().catch(() => null);
    const fieldErrors: ImportFieldError[] = [];
    if (Array.isArray(problem?.errors)) {
      for (const error of problem.errors) {
        if (typeof error?.field === 'string' && typeof error?.message === 'string') {
          fieldErrors.push({ field: error.field, message: error.message });
        }
      }
    }
    throw new EventImportError('The backend rejected this batch. No events were saved. Correct the listed fields and choose the updated file.', fieldErrors);
  }
  if (!response.ok) {
    throw new EventImportError(`Could not confirm the import (HTTP ${response.status}). Refresh the table before retrying; repeating an import can create duplicates.`);
  }
  try {
    return await response.json();
  } catch {
    throw new EventImportError('The import response could not be read. Refresh the table before retrying; repeating an import can create duplicates.');
  }
}
