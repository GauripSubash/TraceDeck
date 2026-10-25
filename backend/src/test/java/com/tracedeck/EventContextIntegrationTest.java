package com.tracedeck;

import com.tracedeck.event.Event;
import com.tracedeck.event.EventRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.nullValue;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EventContextIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired EventRepository repository;

    private final String requestId = "ctx-" + UUID.randomUUID().toString().substring(0, 30);
    private final Instant start = Instant.parse("2026-09-20T14:00:00Z");

    private Event store(int seconds, Event.Level level, String type, String source, String request) {
        return repository.saveAndFlush(new Event(UUID.randomUUID(), start.plusSeconds(seconds),
                source, level, type, type, request, null, null, null));
    }

    private Event store(int seconds, Event.Level level, String type) {
        return store(seconds, level, type, "payment-service", requestId);
    }

    @Test
    void groupsSameRequestAcrossServicesAndOrdersOldestFirst() throws Exception {
        Event first = store(0, Event.Level.INFO, "RECEIVED", "web-gateway", requestId);
        Event second = store(1, Event.Level.WARN, "SLOW", "checkout-service", requestId);
        Event selected = store(2, Event.Level.ERROR, "TIMEOUT");
        store(1, Event.Level.ERROR, "UNRELATED", "auth-service", "other-" + requestId);

        mvc.perform(get("/api/events/{id}/context", selected.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.selectedEvent.id").value(selected.getId().toString()))
                .andExpect(jsonPath("$.requestId").value(requestId))
                .andExpect(jsonPath("$.precedingEvents.length()").value(2))
                .andExpect(jsonPath("$.precedingEvents[0].id").value(first.getId().toString()))
                .andExpect(jsonPath("$.precedingEvents[1].id").value(second.getId().toString()))
                .andExpect(jsonPath("$.eventCount").value(3));
    }

    @Test
    void excludesSelectedAndLaterEventsButIncludesEqualTimestamps() throws Exception {
        Event earlier = store(0, Event.Level.INFO, "RECEIVED");
        Event selected = store(2, Event.Level.ERROR, "TIMEOUT");
        Event sameTime = store(2, Event.Level.WARN, "SLOW");
        store(3, Event.Level.INFO, "RETRY");

        mvc.perform(get("/api/events/{id}/context", selected.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.precedingEvents.length()").value(2))
                .andExpect(jsonPath("$.precedingEvents[0].id").value(earlier.getId().toString()))
                .andExpect(jsonPath("$.precedingEvents[1].id").value(sameTime.getId().toString()));
    }

    @Test
    void defaultAndCustomLimitsReturnNearestEventsChronologically() throws Exception {
        for (int second = 0; second < 7; second++) {
            store(second, Event.Level.INFO, "STEP_" + second);
        }
        Event selected = store(7, Event.Level.ERROR, "TIMEOUT");
        mvc.perform(get("/api/events/{id}/context", selected.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.precedingEvents.length()").value(5))
                .andExpect(jsonPath("$.precedingEvents[0].eventType").value("STEP_2"))
                .andExpect(jsonPath("$.precedingEvents[4].eventType").value("STEP_6"))
                .andExpect(jsonPath("$.eventCount").value(6));
        mvc.perform(get("/api/events/{id}/context", selected.getId()).param("limit", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.precedingEvents.length()").value(2))
                .andExpect(jsonPath("$.precedingEvents[0].eventType").value("STEP_5"))
                .andExpect(jsonPath("$.precedingEvents[1].eventType").value("STEP_6"))
                .andExpect(jsonPath("$.eventCount").value(3));
    }

    @Test
    void probableCauseIsEarliestWarningOrErrorNotMostSevere() throws Exception {
        store(0, Event.Level.INFO, "RECEIVED");
        store(1, Event.Level.WARN, "PROVIDER_SLOW");
        store(2, Event.Level.ERROR, "PROVIDER_TIMEOUT");
        Event selected = store(3, Event.Level.ERROR, "CHECKOUT_FAILED");
        mvc.perform(get("/api/events/{id}/context", selected.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.probableCause").value("PROVIDER_SLOW"));
    }

    @Test
    void causeUsesReturnedWindowAndFallsBackToSelectedEvent() throws Exception {
        store(0, Event.Level.WARN, "OLDER_WARNING");
        store(1, Event.Level.INFO, "RETRY");
        Event selected = store(2, Event.Level.ERROR, "TIMEOUT");
        mvc.perform(get("/api/events/{id}/context", selected.getId()).param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.probableCause").value("TIMEOUT"))
                .andExpect(jsonPath("$.precedingEvents.length()").value(1));
    }

    @Test
    void unknownEventReturns404() throws Exception {
        mvc.perform(get("/api/events/{id}/context", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    void invalidLimitsAndMalformedIdReturn400() throws Exception {
        Event selected = store(0, Event.Level.ERROR, "TIMEOUT");
        for (String limit : new String[]{"0", "-1", "6", "abc", "1.5"}) {
            mvc.perform(get("/api/events/{id}/context", selected.getId()).param("limit", limit))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/events/not-a-uuid/context"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void noWarningOrErrorProducesNullCauseWithOrWithoutHistory() throws Exception {
        Event first = store(0, Event.Level.INFO, "RECEIVED");
        mvc.perform(get("/api/events/{id}/context", first.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.precedingEvents").isEmpty())
                .andExpect(jsonPath("$.eventCount").value(1))
                .andExpect(jsonPath("$.probableCause").value(nullValue()));
        Event second = store(1, Event.Level.INFO, "COMPLETED");
        mvc.perform(get("/api/events/{id}/context", second.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.precedingEvents.length()").value(1))
                .andExpect(jsonPath("$.probableCause").value(nullValue()));
    }
}
