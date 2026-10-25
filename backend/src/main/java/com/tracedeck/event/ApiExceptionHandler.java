package com.tracedeck.event;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import com.fasterxml.jackson.databind.JsonMappingException;
import java.util.List;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(InvalidQueryException.class)
    public ProblemDetail invalidQuery(InvalidQueryException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Invalid query parameter: " + exception.getField());
        problem.setProperty("errors", List.of(new ImportValidationException.FieldError(
                exception.getField(), exception.getMessage())));
        return problem;
    }
    @ExceptionHandler(ImportValidationException.class)
    public ProblemDetail invalidImport(ImportValidationException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        problem.setProperty("errors", exception.getErrors());
        return problem;
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail malformedJson(HttpMessageNotReadableException exception) {
        String field = "events";
        // Jackson's path identifies the array element/field that could not be read.
        // Do not expose raw parser messages or submitted values in the response.
        Throwable cause = exception.getCause();
        if (cause instanceof JsonMappingException mapping) {
            var path = new StringBuilder("events");
            for (var reference : mapping.getPath()) {
                if (reference.getFieldName() != null) {
                    path.append('.').append(reference.getFieldName());
                } else if (reference.getIndex() >= 0) {
                    path.append('[').append(reference.getIndex()).append(']');
                }
            }
            field = path.toString();
        }
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Expected a JSON array of events with valid field types; no events were saved.");
        problem.setProperty("errors", List.of(new ImportValidationException.FieldError(
                field, "missing or malformed JSON value")));
        return problem;
    }
    @ExceptionHandler(EventNotFoundException.class)
    public ProblemDetail notFound(EventNotFoundException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail invalidParameter(MethodArgumentTypeMismatchException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Invalid value for parameter: " + exception.getName());
    }
}
