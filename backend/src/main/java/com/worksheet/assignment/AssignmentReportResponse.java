package com.worksheet.assignment;

import java.time.Instant;

public record AssignmentReportResponse(
    Long assignmentId,
    Long classroomId,
    String classroomName,
    Long worksheetId,
    Long revisionId,
    int revisionNumber,
    String worksheetName,
    String worksheetCode,
    String codeStatus,
    Long userId,
    String userName,
    Instant assignedAt,
    Instant revokedAt,
    Instant removedAt,
    String status,
    Long attemptId,
    Integer totalScore,
    Integer maxScore,
    Instant completedAt,
    java.util.UUID batchId
) {}
