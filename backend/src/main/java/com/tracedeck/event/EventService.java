package com.tracedeck.event;

import java.util.UUID;
import java.util.List;
import java.util.ArrayList;
import java.util.Comparator;
import jakarta.validation.Validator;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventService {
    private final EventRepository repository;
    private final Validator validator;

    public EventService(EventRepository repository, Validator validator) {
        this.repository = repository;
        this.validator = validator;
    }

    @Transactional(readOnly = true)
    public EventPageResponse searchEvents(String source, Instant from, Instant to, int page, int size) {
        if (page < 0) {
            throw new InvalidQueryException("page", "must be zero or greater");
        }
        if (size < 1 || size > 50) {
            throw new InvalidQueryException("size", "must be between 1 and 50");
        }
        if (from != null && to != null && from.isAfter(to)) {
            throw new InvalidQueryException("from", "must be earlier than or equal to to");
        }
        if (source != null && (source.isBlank() || source.length() > 50)) {
            throw new InvalidQueryException("source", "must be nonblank and at most 50 characters");
        }
        // ID breaks timestamp ties, keeping page ordering deterministic for unchanged data.
        Sort order = Sort.by(Sort.Order.desc("occurredAt"), Sort.Order.asc("id"));
        Page<Event> result = repository.findAll(
                EventSpecifications.matching(source, from, to), PageRequest.of(page, size, order));
        List<EventResponse> content = new ArrayList<>();
        for (Event event : result.getContent()) {
            content.add(EventResponse.from(event));
        }
        return new EventPageResponse(content, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @Transactional
    public ImportResponse importEvents(List<EventRequest> requests) {
        var errors = new ArrayList<ImportValidationException.FieldError>();
        if (requests == null || requests.isEmpty() || requests.size() > 500) {
            throw new ImportValidationException(List.of(new ImportValidationException.FieldError(
                    "events", "must contain between 1 and 500 events")));
        }
        // Validate the entire batch before issuing any writes, including null elements.
        for (int index = 0; index < requests.size(); index++) {
            EventRequest request = requests.get(index);
            String prefix = "events[" + index + "]";
            if (request == null) {
                errors.add(new ImportValidationException.FieldError(prefix, "must not be null"));
            } else {
                validator.validate(request).forEach(violation -> errors.add(
                        new ImportValidationException.FieldError(
                                prefix + "." + violation.getPropertyPath(), violation.getMessage())));
            }
        }
        if (!errors.isEmpty()) {
            errors.sort(Comparator.comparing(ImportValidationException.FieldError::field)
                    .thenComparing(ImportValidationException.FieldError::message));
            throw new ImportValidationException(errors);
        }
        List<Event> events = requests.stream().map(EventRequest::toEvent).toList();
        repository.saveAllAndFlush(events);
        return new ImportResponse(events.size(), "Events imported successfully",
                events.stream().map(Event::getId).toList());
    }

    @Transactional(readOnly = true)
    public ContextResponse getContext(UUID id, int limit) {
        if (limit < 1 || limit > 5) {
            throw new InvalidQueryException("limit", "must be between 1 and 5");
        }
        Event selected = repository.findById(id)
                .orElseThrow(() -> new EventNotFoundException(id));

        // Fetch only the nearest N events in the database, then reverse for display.
        List<Event> nearestFirst = repository.findPrecedingEvents(
                selected.getRequestId(), selected.getOccurredAt(), selected.getId(),
                PageRequest.of(0, limit));
        List<EventResponse> preceding = new ArrayList<>();
        String probableCause = null;
        for (int index = nearestFirst.size() - 1; index >= 0; index--) {
            Event event = nearestFirst.get(index);
            preceding.add(EventResponse.from(event));
            if (probableCause == null && event.getLevel() != Event.Level.INFO) {
                probableCause = event.getEventType();
            }
        }
        // The selected event is also part of the returned timeline.
        if (probableCause == null && selected.getLevel() != Event.Level.INFO) {
            probableCause = selected.getEventType();
        }
        return new ContextResponse(EventResponse.from(selected), preceding,
                selected.getRequestId(), probableCause, preceding.size() + 1);
    }

    @Transactional(readOnly = true)
    public EventResponse getEvent(UUID id) {
        Event event = repository.findById(id)
                .orElseThrow(() -> new EventNotFoundException(id));
        return EventResponse.from(event);
    }
}
