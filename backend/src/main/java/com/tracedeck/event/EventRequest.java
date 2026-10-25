package com.tracedeck.event;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.UUID;

/** Incoming JSON fields and their validation rules; IDs are assigned by the server. */
public record EventRequest(
        @NotNull Instant occurredAt,
        @NotBlank @Size(max = 50) String source,
        @NotBlank @Pattern(regexp = "INFO|WARN|ERROR", message = "must be INFO, WARN, or ERROR") String level,
        @NotBlank @Size(max = 60) String eventType,
        @NotBlank @Size(max = 255) String message,
        @NotBlank @Size(max = 40) String requestId,
        @Min(100) @Max(599) Integer statusCode,
        @PositiveOrZero Integer durationMs,
        String details) {

    public Event toEvent() {
        return new Event(UUID.randomUUID(), occurredAt, source, Event.Level.valueOf(level),
                eventType, message, requestId, statusCode, durationMs, details);
    }
}
