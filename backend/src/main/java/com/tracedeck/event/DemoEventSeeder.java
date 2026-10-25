package com.tracedeck.event;

import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** A temporary one-event fixture for the first milestone, enabled explicitly. */
@Component
@Profile("demo")
public class DemoEventSeeder implements ApplicationRunner {
    public static final UUID EVENT_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final Logger log = LoggerFactory.getLogger(DemoEventSeeder.class);
    private final EventRepository repository;

    public DemoEventSeeder(EventRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!repository.existsById(EVENT_ID)) {
            repository.save(new Event(EVENT_ID, Instant.parse("2026-09-20T14:02:03Z"),
                    "payment-service", Event.Level.ERROR, "PAYMENT_TIMEOUT",
                    "Payment provider timed out", "req-1042", 504, 3000,
                    "{\"provider\":\"sandbox-pay\"}"));
        }
        log.info("Demo event available at /api/events/{}", EVENT_ID);
    }
}
