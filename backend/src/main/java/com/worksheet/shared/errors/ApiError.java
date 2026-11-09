package com.worksheet.shared.errors;

import java.time.Instant;
import java.util.Map;

public record ApiError(
        String code,
        String message,
        Map<String, String> fieldErrors,
        String requestId,
        Instant timestamp) {}
