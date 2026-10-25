package com.tracedeck;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** No test transaction: HTTP writes must actually commit, or leave no rows. */
@SpringBootTest
@AutoConfigureMockMvc
class EventImportIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    private final String requestId = "test-" + UUID.randomUUID().toString().substring(0, 30);

    private Map<String, Object> validEvent() {
        var event = new HashMap<String, Object>();
        event.put("occurredAt", "2026-09-20T14:02:03Z");
        event.put("source", "payment-service");
        event.put("level", "ERROR");
        event.put("eventType", "PAYMENT_TIMEOUT");
        event.put("message", "Payment provider timed out");
        event.put("requestId", requestId);
        event.put("statusCode", 504);
        event.put("durationMs", 3000);
        return event;
    }

    private long storedCount() {
        return jdbc.queryForObject("SELECT count(*) FROM events WHERE request_id = ?", Long.class, requestId);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("DELETE FROM events WHERE request_id = ?", requestId);
    }

    @Test
    void importsBatchAndRetrievesGeneratedIds() throws Exception {
        String response = mvc.perform(post("/api/events/import")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(List.of(validEvent(), validEvent()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imported").value(2))
                .andExpect(jsonPath("$.eventIds.length()").value(2))
                .andReturn().getResponse().getContentAsString();
        var ids = mapper.readTree(response).get("eventIds");
        assertNotEquals(ids.get(0).asText(), ids.get(1).asText());
        assertEquals(2, storedCount());
        for (var id : ids) {
            mvc.perform(get("/api/events/{id}", id.asText()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.requestId").value(requestId));
        }
    }

    @Test
    void acceptsMissingOptionalFieldsAndBoundaryValues() throws Exception {
        var minimal = validEvent();
        minimal.remove("statusCode");
        minimal.remove("durationMs");
        var lower = validEvent();
        lower.put("statusCode", 100);
        lower.put("durationMs", 0);
        var upper = validEvent();
        upper.put("statusCode", 599);
        mvc.perform(post("/api/events/import").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(List.of(minimal, lower, upper))))
                .andExpect(status().isCreated());
        assertEquals(3, storedCount());
    }

    @Test
    void rejectsInvalidFieldsWithIndexedErrorsAndNoWrites() throws Exception {
        var invalidValues = new LinkedHashMap<String, Object>();
        invalidValues.put("source", " ");
        invalidValues.put("level", "DEBUG");
        invalidValues.put("durationMs", -1);
        invalidValues.put("statusCode", 600);
        invalidValues.put("eventType", "x".repeat(61));
        invalidValues.put("message", "x".repeat(256));
        invalidValues.put("requestId", "x".repeat(41));
        for (var invalid : invalidValues.entrySet()) {
            var event = validEvent();
            event.put(invalid.getKey(), invalid.getValue());
            mvc.perform(post("/api/events/import").contentType(MediaType.APPLICATION_JSON)
                            .content(mapper.writeValueAsString(List.of(event))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors[0].field").value("events[0]." + invalid.getKey()));
        }
        assertEquals(0, storedCount());
    }

    @Test
    void rejectsMissingRequiredFields() throws Exception {
        for (String field : List.of("occurredAt", "source", "level", "eventType", "message", "requestId")) {
            var event = validEvent();
            event.remove(field);
            mvc.perform(post("/api/events/import").contentType(MediaType.APPLICATION_JSON)
                            .content(mapper.writeValueAsString(List.of(event))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors[0].field").value("events[0]." + field));
        }
        assertEquals(0, storedCount());
    }

    @Test
    void rejectsEntireBatchWhenLaterEventIsInvalid() throws Exception {
        var invalid = validEvent();
        invalid.put("durationMs", -1);
        mvc.perform(post("/api/events/import").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(List.of(validEvent(), invalid))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("events[1].durationMs"));
        assertEquals(0, storedCount());
    }

    @Test
    void enforcesBatchSizeAndRejectsNullElements() throws Exception {
        for (String body : List.of("[]", "[null]", mapper.writeValueAsString(Collections.nCopies(501, validEvent())))) {
            mvc.perform(post("/api/events/import").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors").isArray());
        }
        assertEquals(0, storedCount());
        mvc.perform(post("/api/events/import").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Collections.nCopies(500, validEvent()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imported").value(500));
        assertEquals(500, storedCount());
    }

    @Test
    void rejectsMalformedJsonMissingBodyAndWrongShape() throws Exception {
        var fractional = validEvent();
        fractional.put("durationMs", 1.5);
        for (String body : List.of("", "null", "{}", "[{", "[{\"occurredAt\":\"not-a-date\"}]",
                mapper.writeValueAsString(List.of(fractional)))) {
            mvc.perform(post("/api/events/import").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors").isArray());
        }
        assertEquals(0, storedCount());
    }
}
