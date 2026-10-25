interface FilterBarProps {
  source: string;
  from: string;
  to: string;
  error: string | null;
  loading: boolean;
  onSourceChange: (source: string) => void;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
  onApply: () => void;
  onClear: () => void;
}

export default function FilterBar({ source, from, to, error, loading, onSourceChange, onFromChange, onToChange, onApply, onClear }: FilterBarProps) {
  return (
    <form className="filter-bar" aria-label="Event filters" onSubmit={event => {
      event.preventDefault();
      onApply();
    }}>
      <div className="filter-field">
        <label htmlFor="source-filter">Source</label>
        <select id="source-filter" value={source} disabled={loading} onChange={event => onSourceChange(event.target.value)}>
          <option value="">All services</option>
          <option value="web-gateway">web-gateway</option>
          <option value="auth-service">auth-service</option>
          <option value="checkout-service">checkout-service</option>
          <option value="payment-service">payment-service</option>
        </select>
      </div>
      <div className="filter-field">
        <label htmlFor="from-filter">From (UTC)</label>
        <input id="from-filter" type="datetime-local" step="0.001" min="0001-01-01T00:00" max="9999-12-31T23:59:59.999" value={from} disabled={loading} aria-invalid={error !== null} aria-describedby={error ? 'time-filter-help time-filter-error' : 'time-filter-help'} onInput={event => onFromChange(event.currentTarget.value)} />
      </div>
      <div className="filter-field">
        <label htmlFor="to-filter">To (UTC)</label>
        <input id="to-filter" type="datetime-local" step="0.001" min="0001-01-01T00:00" max="9999-12-31T23:59:59.999" value={to} disabled={loading} aria-invalid={error !== null} aria-describedby={error ? 'time-filter-help time-filter-error' : 'time-filter-help'} onInput={event => onToChange(event.currentTarget.value)} />
      </div>
      <button type="submit" disabled={loading}>Apply filters</button>
      <button type="button" disabled={loading} onClick={onClear}>Clear filters</button>
      <p id="time-filter-help" className="filter-help">Enter UTC times. Both bounds are inclusive; leave either blank for no bound. To ends at the exact time entered.</p>
      {error && <p id="time-filter-error" className="filter-error" role="alert">{error}</p>}
    </form>
  );
}
