import type { ServiceEvent } from '../types';

interface EventTableProps {
  events: ServiceEvent[];
  onInvestigate: (event: ServiceEvent) => void;
}

export default function EventTable({ events, onInvestigate }: EventTableProps) {
  const rows = [];

  for (const event of events) {
    rows.push(
      <tr key={event.id}>
        <td className="mono timestamp"><time dateTime={event.occurredAt}>{new Date(event.occurredAt).toISOString().replace('T', ' ').replace('Z', '')}</time></td>
        <td><span className={`severity severity-${event.level.toLowerCase()}`}>{event.level}</span></td>
        <td className="mono">{event.source}</td>
        <td><span className="event-type mono">{event.eventType}</span><span className="message">{event.message}</span></td>
        <td className="mono request-id">{event.requestId}</td>
        <td className="mono duration">{event.durationMs === null ? '—' : `${event.durationMs} ms`}</td>
        <td><button className="investigate-button" onClick={() => onInvestigate(event)} aria-label={`Investigate ${event.eventType} for ${event.requestId}, event ${event.id}`}>Investigate</button></td>
      </tr>,
    );
  }

  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Service event table, scroll horizontally for more columns">
      <table>
        <caption className="sr-only">Service events, newest first. All timestamps are UTC.</caption>
        <thead><tr><th scope="col">Timestamp / UTC</th><th scope="col">Level</th><th scope="col">Source</th><th scope="col">Event / message</th><th scope="col">Request ID</th><th scope="col">Duration</th><th scope="col">Action</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}
