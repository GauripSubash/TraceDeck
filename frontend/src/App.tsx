import { useEffect, useState } from 'react';
import { fetchEvents } from './api/events';
import { getTimeRange } from './api/filterDates';
import EventTable from './components/EventTable';
import FilterBar from './components/FilterBar';
import InvestigationDrawer from './components/InvestigationDrawer';
import EventImporter from './components/EventImporter';
import type { EventPage, ServiceEvent } from './types';

export default function App() {
  const [page, setPage] = useState<EventPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  // Spring counts pages from 0; the interface displays them starting from 1.
  const [pageNumber, setPageNumber] = useState(0);
  // Editing the selector does not change the query until Apply is pressed.
  const [draftSource, setDraftSource] = useState('');
  const [source, setSource] = useState('');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filterError, setFilterError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ServiceEvent | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadEvents() {
      setLoading(true);
      setError(null);
      setPage(null);

      try {
        const result = await fetchEvents(pageNumber, source, from, to, controller.signal);
        if (!controller.signal.aborted) setPage(result);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Unable to load events. Check the backend connection and retry.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadEvents();
    // Cancel this request when the component leaves or a new effect starts.
    return () => controller.abort();
  }, [reloadCount, pageNumber, source, from, to]);

  function applyFilters() {
    let timeRange;
    try {
      timeRange = getTimeRange(draftFrom, draftTo);
    } catch (cause) {
      setFilterError(cause instanceof Error ? cause.message : 'Check the UTC time range.');
      return;
    }
    setFilterError(null);
    setSource(draftSource);
    setFrom(timeRange.from);
    setTo(timeRange.to);
    setPageNumber(0);
    setReloadCount(current => current + 1);
  }

  function clearFilters() {
    setDraftSource('');
    setSource('');
    setDraftFrom('');
    setDraftTo('');
    setFrom('');
    setTo('');
    setFilterError(null);
    setPageNumber(0);
    setReloadCount(current => current + 1);
  }

  const canGoBack = !loading && pageNumber > 0;
  const hasFilters = source !== '' || from !== '' || to !== '';
  const canGoForward = !loading && page !== null && page.page + 1 < page.totalPages;

  let pageSummary = `Page ${pageNumber + 1} · Up to 20 events`;
  if (page !== null) {
    if (page.totalElements === 0) {
      pageSummary = '0 events';
    } else if (page.content.length === 0) {
      pageSummary = `No events on page ${page.page + 1} · ${page.totalElements} total events`;
    } else {
      const firstEvent = page.page * page.size + 1;
      const lastEvent = firstEvent + page.content.length - 1;
      pageSummary = `Showing ${firstEvent}–${lastEvent} of ${page.totalElements} events · Page ${page.page + 1} of ${page.totalPages}`;
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="TraceDeck home"><span className="brand-mark" aria-hidden="true">T<span>↗</span></span>TraceDeck</a>
        <span className="environment">LOCAL WORKSPACE</span>
      </header>
      <main>
        <div className="page-heading"><div><p className="eyebrow">EVENT EXPLORER</p><h1>Service events</h1><p className="subtitle">Explore synthetic events across your services.</p></div>
          <button disabled={loading} onClick={() => setReloadCount(reloadCount + 1)}>{loading ? 'Loading…' : error ? 'Retry connection' : 'Refresh events'}</button>
        </div>
        <EventImporter onImported={clearFilters} />
        <FilterBar source={draftSource} from={draftFrom} to={draftTo} error={filterError} loading={loading}
          onSourceChange={setDraftSource} onFromChange={setDraftFrom} onToChange={setDraftTo} onApply={applyFilters} onClear={clearFilters} />
        <section className="events-panel" aria-labelledby="events-title" aria-busy={loading}>
          <div className="panel-heading"><h2 id="events-title">Event stream</h2><span className="panel-meta">{source || 'All services'} · Newest first · UTC</span></div>
          {(from || to) && <p className="applied-range">Applied UTC range: {from || 'No start bound'} → {to || 'No end bound'}</p>}
          {loading && <div className="state" role="status"><span className="loading-dot" aria-hidden="true" /><h3>Loading events</h3><p>Requesting page {pageNumber + 1} from the local API.</p></div>}
          {error && <div className="state error-state" role="alert"><h3>Could not load events</h3><p>{error}</p></div>}
          {!loading && !error && page && page.content.length === 0 && (
            <div className="state" role="status">
              <h3>{page.totalElements === 0 ? (hasFilters ? 'No matching events' : 'No events yet') : 'No events on this page'}</h3>
              <p>{page.totalElements === 0 ? (hasFilters ? 'No events match the applied filters. Adjust the source or time range, or clear the filters.' : 'Use Import events above to upload a JSON file. Download the sample JSON to try a complete trace.') : 'The available events may have changed. Use Previous to return to an earlier page.'}</p>
            </div>
          )}
          {!loading && !error && page && page.content.length > 0 && <EventTable events={page.content} onInvestigate={setSelectedEvent} />}
          <div className="panel-footer">
            <span role="status">{pageSummary}</span>
            <nav className="pagination" aria-label="Event pages">
              <button disabled={!canGoBack} onClick={() => setPageNumber(current => current - 1)}>Previous</button>
              <button disabled={!canGoForward} onClick={() => setPageNumber(current => current + 1)}>Next</button>
            </nav>
          </div>
        </section>
        <p className="workspace-note"><span aria-hidden="true">◇</span> Synthetic service events · Local development</p>
      </main>
      {selectedEvent && <InvestigationDrawer key={selectedEvent.id} event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}
