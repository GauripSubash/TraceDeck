package com.tracedeck.event;

import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/** Builds optional conditions that Hibernate translates into SQL WHERE clauses. */
public final class EventSpecifications {
    private EventSpecifications() {}

    public static Specification<Event> matching(String source, Instant from, Instant to) {
        return (root, query, builder) -> {
            List<Predicate> conditions = new ArrayList<>();
            if (source != null) {
                conditions.add(builder.equal(root.get("source"), source));
            }
            if (from != null) {
                conditions.add(builder.greaterThanOrEqualTo(root.get("occurredAt"), from));
            }
            if (to != null) {
                conditions.add(builder.lessThanOrEqualTo(root.get("occurredAt"), to));
            }
            return builder.and(conditions.toArray(new Predicate[0]));
        };
    }
}
