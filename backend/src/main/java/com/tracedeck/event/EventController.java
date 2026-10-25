package com.tracedeck.event;

import java.util.UUID;
import java.util.List;
import java.time.Instant;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/events")
public class EventController {
    private final EventService service;

    public EventController(EventService service) {
        this.service = service;
    }

    @GetMapping
    public EventPageResponse searchEvents(
            @RequestParam(required = false) String source,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.searchEvents(source, from, to, page, size);
    }

    @PostMapping("/import")
    @ResponseStatus(HttpStatus.CREATED)
    public ImportResponse importEvents(@RequestBody List<EventRequest> requests) {
        return service.importEvents(requests);
    }

    @GetMapping("/{id}")
    public EventResponse getEvent(@PathVariable UUID id) {
        return service.getEvent(id);
    }

    @GetMapping("/{id}/context")
    public ContextResponse getContext(@PathVariable UUID id,
                                     @RequestParam(defaultValue = "5") int limit) {
        return service.getContext(id, limit);
    }
}
