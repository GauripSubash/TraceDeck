package com.tracedeck.event;

import java.util.List;

public record ContextResponse(EventResponse selectedEvent,
                              List<EventResponse> precedingEvents,
                              String requestId, String probableCause, int eventCount) {}
