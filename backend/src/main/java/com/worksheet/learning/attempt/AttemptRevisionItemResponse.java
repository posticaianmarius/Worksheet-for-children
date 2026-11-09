package com.worksheet.learning.attempt;

import tools.jackson.databind.JsonNode;

public record AttemptRevisionItemResponse(
        Long id,
        Long miniGameId,
        int orderIndex,
        JsonNode configuration,
        com.worksheet.content.catalog.MiniGameDefinitionResponse definition) {}
