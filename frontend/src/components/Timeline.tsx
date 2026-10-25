import type { ServiceEvent } from '../types';

interface TimelineProps {
  precedingEvents: ServiceEvent[];
  selectedEvent: ServiceEvent;
}

export default function Timeline({ precedingEvents, selectedEvent }: TimelineProps) {
  // The backend already returns history oldest first. Keep its tie ordering.
  const events = [...precedingEvents, selectedEvent];
  const entries = [];

  for (const event of events) {
    const isSelected = event.id === selectedEvent.id;
    entries.push(
      <li key={event.id} className={isSelected ? 'timeline-event selected-event' : 'timeline-event'}>
        <div className="timeline-card">
          <div className="timeline-event-heading">
            <h4 className="mono">{event.eventType}</h4>
            <span className={`severity severity-${event.level.toLowerCase()}`}>{event.level}</span>
          </div>
          <div className="timeline-meta">
            <span className="mono">{event.source}</span>
            {isSelected && <span className="selected-label">Selected event</span>}
          </div>
          <time className="mono timeline-time" dateTime={event.occurredAt}>{new Date(event.occurredAt).toISOString().replace('T', ' ').replace('Z', '')} UTC</time>
          <p>{event.message}</p>
        </div>
      </li>,
    );
  }

  return <ol className="timeline" aria-label="Request timeline, oldest to newest">{entries}</ol>;
}
