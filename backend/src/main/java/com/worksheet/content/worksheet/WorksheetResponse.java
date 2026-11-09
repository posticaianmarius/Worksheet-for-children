package com.worksheet.content.worksheet;

import com.worksheet.content.worksheet.item.WorksheetItemResponse;

import java.time.Instant;
import java.util.List;

public record WorksheetResponse(
        Long id,
        String name,
        Instant createdAt,
        Instant updatedAt,
        List<WorksheetItemResponse> items) {}
