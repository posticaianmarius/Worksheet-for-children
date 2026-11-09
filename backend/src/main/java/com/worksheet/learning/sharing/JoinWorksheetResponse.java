package com.worksheet.learning.sharing;

import com.worksheet.content.worksheet.*;
import com.worksheet.content.worksheet.item.WorksheetItemResponse;

import java.time.Instant;
import java.util.List;

/**
 * Keeps the worksheet fields at the top level for the existing client while exposing the assignment
 * required by the canonical attempt API.
 */
public record JoinWorksheetResponse(
        Long id,
        String name,
        Instant createdAt,
        Instant updatedAt,
        List<WorksheetItemResponse> items,
        Long assignmentId) {
    public static JoinWorksheetResponse from(WorksheetResponse worksheet, Long assignmentId) {
        return new JoinWorksheetResponse(
                worksheet.id(),
                worksheet.name(),
                worksheet.createdAt(),
                worksheet.updatedAt(),
                worksheet.items(),
                assignmentId);
    }
}
