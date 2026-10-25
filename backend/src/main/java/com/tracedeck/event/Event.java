package com.tracedeck.event;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Maps one Java object to one row in the events table. */
@Entity
@Table(name = "events")
public class Event {
    public enum Level { INFO, WARN, ERROR }

    @Id
    private UUID id;
    @Column(nullable = false)
    private Instant occurredAt;
    @Column(nullable = false, length = 50)
    private String source;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Level level;
    @Column(nullable = false, length = 60)
    private String eventType;
    @Column(nullable = false, length = 255)
    private String message;
    @Column(nullable = false, length = 40)
    private String requestId;
    private Integer statusCode;
    private Integer durationMs;
    @Column(columnDefinition = "text")
    private String details;

    // JPA needs a no-argument constructor to recreate objects from database rows.
    protected Event() {}

    public Event(UUID id, Instant occurredAt, String source, Level level,
                 String eventType, String message, String requestId,
                 Integer statusCode, Integer durationMs, String details) {
        this.id = id;
        this.occurredAt = occurredAt;
        this.source = source;
        this.level = level;
        this.eventType = eventType;
        this.message = message;
        this.requestId = requestId;
        this.statusCode = statusCode;
        this.durationMs = durationMs;
        this.details = details;
    }

    public UUID getId() { return id; }
    public Instant getOccurredAt() { return occurredAt; }
    public String getSource() { return source; }
    public Level getLevel() { return level; }
    public String getEventType() { return eventType; }
    public String getMessage() { return message; }
    public String getRequestId() { return requestId; }
    public Integer getStatusCode() { return statusCode; }
    public Integer getDurationMs() { return durationMs; }
    public String getDetails() { return details; }
}
