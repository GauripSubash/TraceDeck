package com.tracedeck.event;

import java.util.UUID;
import java.util.List;
import java.time.Instant;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

// Spring Data supplies the implementation, including save() and findById().
public interface EventRepository extends JpaRepository<Event, UUID>, JpaSpecificationExecutor<Event> {
    @Query("""
            SELECT e FROM Event e
            WHERE e.requestId = :requestId
              AND e.occurredAt <= :selectedTime
              AND e.id <> :selectedId
            ORDER BY e.occurredAt DESC, e.id DESC
            """)
    List<Event> findPrecedingEvents(@Param("requestId") String requestId,
                                    @Param("selectedTime") Instant selectedTime,
                                    @Param("selectedId") UUID selectedId,
                                    Pageable pageable);
}
