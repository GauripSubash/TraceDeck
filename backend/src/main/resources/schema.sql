CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL,
    source VARCHAR(50) NOT NULL,
    level VARCHAR(10) NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR')),
    event_type VARCHAR(60) NOT NULL,
    message VARCHAR(255) NOT NULL,
    request_id VARCHAR(40) NOT NULL,
    status_code INTEGER CHECK (status_code BETWEEN 100 AND 599),
    duration_ms INTEGER CHECK (duration_ms >= 0),
    details TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_source_time ON events (source, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_request_time ON events (request_id, occurred_at ASC);
