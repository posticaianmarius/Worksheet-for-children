package com.worksheet.shared.errors;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> responseStatus(
            ResponseStatusException error, HttpServletRequest request) {
        HttpStatus status = HttpStatus.valueOf(error.getStatusCode().value());
        return response(status, status.name(), error.getReason(), Map.of(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(
            MethodArgumentNotValidException error, HttpServletRequest request) {
        Map<String, String> fields = new LinkedHashMap<>();
        error.getBindingResult()
                .getFieldErrors()
                .forEach(value -> fields.putIfAbsent(value.getField(), value.getDefaultMessage()));
        return response(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_FAILED",
                "Request validation failed.",
                fields,
                request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> unreadable(
            HttpMessageNotReadableException error, HttpServletRequest request) {
        return response(
                HttpStatus.BAD_REQUEST,
                "INVALID_JSON",
                "Request body is invalid.",
                Map.of(),
                request);
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiError> stale(
            ObjectOptimisticLockingFailureException error, HttpServletRequest request) {
        return response(
                HttpStatus.CONFLICT,
                "STALE_UPDATE",
                "This resource changed while it was being edited. Reload and try again.",
                Map.of(),
                request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> conflict(
            DataIntegrityViolationException error, HttpServletRequest request) {
        return response(
                HttpStatus.CONFLICT,
                "DATA_CONFLICT",
                "The requested change conflicts with existing data.",
                Map.of(),
                request);
    }

    private ResponseEntity<ApiError> response(
            HttpStatus status,
            String code,
            String message,
            Map<String, String> fields,
            HttpServletRequest request) {
        String requestId = (String) request.getAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE);
        return ResponseEntity.status(status)
                .body(
                        new ApiError(
                                code,
                                message == null ? status.getReasonPhrase() : message,
                                fields,
                                requestId,
                                Instant.now()));
    }
}
