package com.worksheet.content.worksheet.item;

import tools.jackson.databind.JsonNode;

public record CreateWorksheetItemRequest(Long miniGameId, int orderIndex, JsonNode configuration) {}
