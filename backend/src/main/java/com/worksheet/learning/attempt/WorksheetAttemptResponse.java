package com.worksheet.learning.attempt;

import java.time.Instant;
import java.util.List;

public record WorksheetAttemptResponse(
        Long id,
        Long worksheetId,
        Long revisionId,
        int revisionNumber,
        Long assignmentId,
        AttemptStatus status,
        int totalScore,
        int maxScore,
        Instant startedAt,
        Instant completedAt,
        List<AttemptRevisionItemResponse> items,
        List<AttemptItemResultResponse> results) {}
