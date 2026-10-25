package com.tracedeck;

import com.tracedeck.event.Event;
import com.tracedeck.event.EventRepository;
import jakarta.persistence.EntityManager;
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

/** Uses the local PostgreSQL database. Each test rolls back its changes. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EventEndpointIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired EventRepository repository;
    @Autowired EntityManager entityManager;

    @Test
    void returnsEventPersistedInPostgresql() throws Exception {
        UUID id = UUID.randomUUID();
        repository.saveAndFlush(new Event(id, Instant.parse("2026-09-20T14:02:03Z"),
                "payment-service", Event.Level.ERROR, "PAYMENT_TIMEOUT",
                "Payment provider timed out", "req-test", 504, 3000,
                "{\"provider\":\"sandbox-pay\"}"));
        // Clear JPA's cache so retrieval must read the database row.
        entityManager.clear();

        mvc.perform(get("/api/events/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.occurredAt").value("2026-09-20T14:02:03Z"))
                .andExpect(jsonPath("$.source").value("payment-service"))
                .andExpect(jsonPath("$.level").value("ERROR"))
                .andExpect(jsonPath("$.eventType").value("PAYMENT_TIMEOUT"))
                .andExpect(jsonPath("$.requestId").value("req-test"))
                .andExpect(jsonPath("$.statusCode").value(504))
                .andExpect(jsonPath("$.durationMs").value(3000))
                .andExpect(jsonPath("$.details").value("{\"provider\":\"sandbox-pay\"}"));
    }

    @Test
    void unknownEventReturns404() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(get("/api/events/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Event not found: " + id));
    }

    @Test
    void malformedUuidReturns400() throws Exception {
        mvc.perform(get("/api/events/not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Invalid value for parameter: id"));
    }
}
