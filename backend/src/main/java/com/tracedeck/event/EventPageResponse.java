package com.tracedeck.event;

import java.util.List;

/** Stable API format rather than exposing Spring's internal Page representation. */
public record EventPageResponse(List<EventResponse> content, int page, int size,
                                long totalElements, int totalPages) {}
