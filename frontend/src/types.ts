// These fields match the backend EventResponse JSON, not the database column names.
export interface ServiceEvent {
  id: string;
  occurredAt: string;
  source: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  eventType: string;
  message: string;
  requestId: string;
  statusCode: number | null;
  durationMs: number | null;
  details: string | null;
}

export interface EventPage {
  content: ServiceEvent[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface EventContext {
  selectedEvent: ServiceEvent;
  precedingEvents: ServiceEvent[];
  requestId: string;
  probableCause: string | null;
  eventCount: number;
}

export interface ImportResult {
  imported: number;
  message: string;
  eventIds: string[];
}
