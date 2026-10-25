package com.tracedeck.event;

import java.util.List;

public class ImportValidationException extends RuntimeException {
    public record FieldError(String field, String message) {}

    private final List<FieldError> errors;

    public ImportValidationException(List<FieldError> errors) {
        super("Import rejected; no events were saved.");
        this.errors = List.copyOf(errors);
    }

    public List<FieldError> getErrors() { return errors; }
}
