package com.tracedeck;

import com.tracedeck.event.Event;
import com.tracedeck.event.EventRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EventSearchIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired EventRepository repository;
    @Autowired EntityManager entityManager;

    private final String source = "test-" + UUID.randomUUID();
    private final String otherSource = "test-" + UUID.randomUUID();
    private final Instant start = Instant.parse("2199-01-01T00:00:00Z");
    private final long idPrefix = UUID.randomUUID().getMostSignificantBits();

    private UUID id(int number) { return new UUID(idPrefix, number); }

    @BeforeEach
    void storeSearchFixture() {
        repository.saveAllAndFlush(List.of(
                event(1, source, 0), event(2, otherSource, 1),
                event(3, source, 2), event(4, source, 2), event(5, source, 3)));
        entityManager.clear();
    }

    private Event event(int number, String service, int seconds) {
        return new Event(id(number), start.plusSeconds(seconds), service, Event.Level.INFO,
                "SEARCH_TEST", "Search fixture", "req-search-test", null, null, null);
    }

    @Test
    void defaultsReturnPageMetadataAndOutOfRangePageIsEmpty() throws Exception {
        mvc.perform(get("/api/events"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value((int) repository.count()));
        mvc.perform(get("/api/events").param("source", source).param("page", "9").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    @Test
    void filtersBySourceAndReturnsNewestFirst() throws Exception {
        mvc.perform(get("/api/events").param("source", source))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.content[0].id").value(id(5).toString()))
                .andExpect(jsonPath("$.content[1].id").value(id(3).toString()))
                .andExpect(jsonPath("$.content[2].id").value(id(4).toString()))
                .andExpect(jsonPath("$.content[3].id").value(id(1).toString()));
        mvc.perform(get("/api/events").param("source", "missing-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.totalPages").value(0));
    }

    @Test
    void timeBoundsAreInclusiveAndCanBeUsedIndependently() throws Exception {
        mvc.perform(get("/api/events")
                        .param("from", start.plusSeconds(1).toString())
                        .param("to", start.plusSeconds(2).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3));
        mvc.perform(get("/api/events").param("source", source).param("from", start.plusSeconds(2).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3));
        mvc.perform(get("/api/events").param("source", source).param("to", start.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void combinesSourceAndTimeFiltersIncludingEqualBounds() throws Exception {
        mvc.perform(get("/api/events").param("source", source)
                        .param("from", start.plusSeconds(1).toString())
                        .param("to", start.plusSeconds(2).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/events").param("source", source)
                        .param("from", start.plusSeconds(2).toString())
                        .param("to", start.plusSeconds(2).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void paginationUsesStableTimestampTieBreakAndCorrectCounts() throws Exception {
        mvc.perform(get("/api/events").param("source", source).param("size", "2").param("page", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].id").value(id(5).toString()))
                .andExpect(jsonPath("$.content[1].id").value(id(3).toString()))
                .andExpect(jsonPath("$.totalPages").value(2));
        mvc.perform(get("/api/events").param("source", source).param("size", "2").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.content[0].id").value(id(4).toString()))
                .andExpect(jsonPath("$.content[1].id").value(id(1).toString()));
        for (String size : List.of("1", "50")) {
            mvc.perform(get("/api/events").param("source", source).param("size", size))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void rejectsInvalidPaginationDatesAndSource() throws Exception {
        for (String[] parameter : List.of(
                new String[]{"page", "-1"}, new String[]{"page", "abc"},
                new String[]{"size", "0"}, new String[]{"size", "51"},
                new String[]{"size", "1.5"}, new String[]{"from", "not-a-date"},
                new String[]{"to", "2026-09-20"}, new String[]{"source", " "},
                new String[]{"source", "x".repeat(51)})) {
            mvc.perform(get("/api/events").param(parameter[0], parameter[1]))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/events").param("from", start.plusSeconds(1).toString())
                        .param("to", start.toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("from"));
    }
}
