package com.worksheet.learning.assignment;

import com.worksheet.content.worksheet.WorksheetResponse;

import java.time.Instant;
import java.util.UUID;

public record WorksheetAssignmentResponse(
        Long id,
        UUID batchId,
        WorksheetResponse worksheet,
        Long teacherId,
        String teacherName,
        Long classroomId,
        Long userId,
        String userName,
        Instant assignedAt,
        Instant revokedAt,
        AssignmentStatus status,
        String deliveryTitle,
        String classroomName) {}
