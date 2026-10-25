package com.tracedeck.event;

import java.util.List;
import java.util.UUID;

public record ImportResponse(int imported, String message, List<UUID> eventIds) {}
