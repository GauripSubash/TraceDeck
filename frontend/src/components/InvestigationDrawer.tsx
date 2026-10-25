import { useEffect, useRef, useState } from 'react';
import { fetchEventContext } from '../api/events';
import type { EventContext, ServiceEvent } from '../types';
import Timeline from './Timeline';

interface InvestigationDrawerProps {
  event: ServiceEvent;
  onClose: () => void;
}

export default function InvestigationDrawer({ event, onClose }: InvestigationDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [context, setContext] = useState<EventContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    // A native modal dialog provides keyboard focus containment and an inert background.
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadContext() {
      setLoading(true);
      setError(null);
      setContext(null);
      try {
        const result = await fetchEventContext(event.id, controller.signal);
        if (!controller.signal.aborted) setContext(result);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Unable to load investigation context. Please retry.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadContext();
    // Closing the drawer or selecting another event cancels its obsolete request.
    return () => controller.abort();
  }, [event.id, retryCount]);

  return (
    <dialog className="investigation-drawer" ref={dialogRef} aria-labelledby="investigation-title" onCancel={cancelEvent => {
      cancelEvent.preventDefault();
      onClose();
    }}>
      <header className="drawer-header">
        <div><p className="eyebrow">REQUEST INVESTIGATION</p><h2 id="investigation-title">Event context</h2></div>
        <button autoFocus onClick={onClose} aria-label="Close investigation">Close</button>
      </header>
      <div className="drawer-body" aria-busy={loading}>
        <p className="drawer-request">Request ID <span className="mono">{event.requestId}</span></p>
        <p className="drawer-description">Up to five preceding events across services, followed by the selected event. Table filters do not restrict this history.</p>
        {loading && <div className="state" role="status"><h3>Loading investigation</h3><p>Retrieving related events from the local API.</p></div>}
        {error && <div className="state error-state" role="alert"><h3>Could not load investigation</h3><p>{error}</p><button className="retry-context" onClick={() => setRetryCount(current => current + 1)}>Retry investigation</button></div>}
        {!loading && context && (
          <>
            <section className="cause-panel" aria-labelledby="cause-title">
              <h3 id="cause-title">Probable cause · heuristic</h3>
              <p className="mono cause-value">{context.probableCause ?? 'No WARN or ERROR in the returned timeline'}</p>
              <p>Earliest WARN or ERROR in this returned window, including the selected event. This is a suggestion, not a proven root cause.</p>
            </section>
            <section aria-labelledby="timeline-title">
              <div className="timeline-heading"><h3 id="timeline-title">Timeline</h3><span>{context.eventCount} {context.eventCount === 1 ? 'event' : 'events'} returned</span></div>
              <p className="drawer-description">Oldest to newest · UTC. Events at the same timestamp have no established causal order.</p>
              {context.precedingEvents.length === 0 && <p className="no-history">No preceding events were found for this request at or before the selected time.</p>}
              <Timeline precedingEvents={context.precedingEvents} selectedEvent={context.selectedEvent} />
            </section>
            <section className="event-details" aria-labelledby="selected-details-title">
              <h3 id="selected-details-title">Selected event details</h3>
              <dl>
                <dt>Event ID</dt><dd className="mono">{context.selectedEvent.id}</dd>
                <dt>Status code</dt><dd>{context.selectedEvent.statusCode ?? 'Not provided'}</dd>
                <dt>Duration</dt><dd>{context.selectedEvent.durationMs === null ? 'Not provided' : `${context.selectedEvent.durationMs} ms`}</dd>
              </dl>
              <h4>Details</h4>
              <pre>{context.selectedEvent.details ?? 'No additional details provided.'}</pre>
            </section>
          </>
        )}
      </div>
    </dialog>
  );
}
