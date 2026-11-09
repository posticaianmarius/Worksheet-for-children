package com.worksheet.content.worksheet.revision;

import com.worksheet.content.catalog.MiniGameDefinitionService;
import com.worksheet.content.worksheet.Worksheet;
import com.worksheet.content.worksheet.WorksheetResponse;
import com.worksheet.content.worksheet.item.WorksheetItemResponse;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class WorksheetRevisionResponseMapper {
    private final MiniGameDefinitionService definitions;
    private final WorksheetRevisionItemRepository revisionItems;

    public WorksheetRevisionResponseMapper(
            WorksheetRevisionItemRepository revisionItems, MiniGameDefinitionService definitions) {
        this.definitions = definitions;
        this.revisionItems = revisionItems;
    }

    public WorksheetResponse toResponse(WorksheetRevision revision) {
        Worksheet worksheet = revision.getWorksheet();
        List<WorksheetItemResponse> items =
                revisionItems.findByRevision_IdOrderByOrderIndex(revision.getId()).stream()
                        .map(
                                item ->
                                        new WorksheetItemResponse(
                                                item.getId(),
                                                worksheet.getId(),
                                                item.getMiniGameDefinition().getId(),
                                                item.getOrderIndex(),
                                                item.getConfiguration(),
                                                definitions.toResponse(
                                                        item.getMiniGameDefinition())))
                        .toList();

        return new WorksheetResponse(
                worksheet.getId(),
                revision.getNameSnapshot(),
                worksheet.getCreatedAt(),
                revision.getPublishedAt(),
                items);
    }
}
