package com.worksheet.learning.legacy.result;

import java.time.Instant;

public record WorksheetResultResponse(
        Long id,
        Long worksheetId,
        Long assignmentId,
        int totalScore,
        int maxScore,
        Instant completedAt) {}
