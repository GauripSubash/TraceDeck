package com.tracedeck.event;

import java.time.Instant;
import java.util.UUID;

/** The JSON response contract, kept separate from the persistence entity. */
public record EventResponse(UUID id, Instant occurredAt, String source,
                            Event.Level level, String eventType, String message,
                            String requestId, Integer statusCode,
                            Integer durationMs, String details) {
    public static EventResponse from(Event event) {
        return new EventResponse(event.getId(), event.getOccurredAt(),
                event.getSource(), event.getLevel(), event.getEventType(),
                event.getMessage(), event.getRequestId(), event.getStatusCode(),
                event.getDurationMs(), event.getDetails());
    }
}
