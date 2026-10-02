package com.roboshop.shipping;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.TransactionException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * MySQL problems are an outage, not a bug: answer 503 instead of 500.
 * The body has the same shape as Spring Boot's own error responses.
 */
@RestControllerAdvice
public class ErrorHandler {

    private static final Logger logger = LoggerFactory.getLogger(ErrorHandler.class);

    @ExceptionHandler({ DataAccessException.class, TransactionException.class })
    public ResponseEntity<Map<String, Object>> databaseDown(Exception e, HttpServletRequest request) {
        logger.error("database error: {}", e.getMessage());
        HttpStatus status = HttpStatus.SERVICE_UNAVAILABLE;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", "database not available");
        body.put("path", request.getRequestURI());
        return ResponseEntity.status(status).header("Retry-After", "30").body(body);
    }
}
