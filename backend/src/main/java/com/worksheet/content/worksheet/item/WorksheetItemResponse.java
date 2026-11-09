package com.worksheet.content.worksheet.item;

import tools.jackson.databind.JsonNode;

public record WorksheetItemResponse(
        Long id,
        Long worksheetId,
        Long miniGameId,
        int orderIndex,
        JsonNode configuration,
        com.worksheet.content.catalog.MiniGameDefinitionResponse definition) {}
