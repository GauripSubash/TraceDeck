import { useEffect, useRef, useState } from 'react';
import { EventImportError, importEvents, parseEventFile } from '../api/importEvents';

interface EventImporterProps {
  onImported: () => void;
}

export default function EventImporter({ onImported }: EventImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<EventImportError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function handleImport() {
    // The ref also guards against repeated submissions before React rerenders.
    if (file === null || requestRef.current !== null) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const events = parseEventFile(await file.text());
      if (controller.signal.aborted) return;
      const result = await importEvents(events, controller.signal);
      if (!controller.signal.aborted) {
        setSuccess(`Imported ${result.imported} events. Filters were cleared and the table was refreshed. Select an event and click Investigate to see its trace.`);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onImported();
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof EventImportError ? cause : new EventImportError('Unable to read the selected file. Choose a readable JSON file and try again.'));
      }
    } finally {
      if (!controller.signal.aborted) {
        requestRef.current = null;
        setImporting(false);
      }
    }
  }

  const fieldErrors = [];
  if (error) {
    for (let index = 0; index < error.fieldErrors.length; index++) {
      const fieldError = error.fieldErrors[index];
      fieldErrors.push(<li key={index}><code>{fieldError.field}</code>: {fieldError.message}</li>);
    }
  }

  return (
    <section className="import-panel" aria-labelledby="import-title">
      <div className="import-heading"><h2 id="import-title">Import events</h2><div className="import-downloads"><a href="/demo-events.json" download>Download 100-event dataset</a><a href="/sample-trace.json" download>Download 4-event sample</a></div></div>
      <p className="import-description">Choose a JSON array of 1–500 synthetic events. Events in one request share a requestId, even across different services.</p>
      <form className="import-form" onSubmit={event => { event.preventDefault(); void handleImport(); }}>
        <div className="import-file"><label htmlFor="event-file">Event JSON file</label>
          <input id="event-file" ref={fileInputRef} type="file" accept=".json,application/json" disabled={importing} aria-describedby="import-help" onChange={event => {
            setFile(event.target.files?.[0] ?? null);
            setError(null);
            setSuccess(null);
          }} />
        </div>
        <button type="submit" disabled={file === null || importing}>{importing ? 'Importing…' : 'Import events'}</button>
      </form>
      <p id="import-help" className="import-help">Import adds records to PostgreSQL. Reimporting the same file creates duplicates. Timestamps need a timezone, for example 2026-09-20T14:02:00Z.</p>
      {importing && <p role="status" className="import-feedback">Reading the file and submitting events…</p>}
      {success && <p role="status" className="import-success">{success}</p>}
      {error && <div role="alert" className="import-error"><p>{error.message}</p>{fieldErrors.length > 0 && <ul>{fieldErrors}</ul>}</div>}
    </section>
  );
}
