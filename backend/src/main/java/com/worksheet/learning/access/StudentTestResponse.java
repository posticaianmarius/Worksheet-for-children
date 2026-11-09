package com.worksheet.learning.access;

import com.worksheet.learning.attempt.AttemptStatus;
import com.worksheet.teaching.classroom.*;

import java.time.Instant;

public record StudentTestResponse(
        Long attemptId,
        Long assignmentId,
        String name,
        AttemptStatus status,
        int totalScore,
        int maxScore,
        Instant startedAt,
        Instant completedAt) {}
