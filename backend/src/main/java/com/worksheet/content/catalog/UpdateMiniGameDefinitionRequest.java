package com.worksheet.content.catalog;

import tools.jackson.databind.JsonNode;

import java.util.Map;

public record UpdateMiniGameDefinitionRequest(
        String name,
        JsonNode configurationSchema,
        JsonNode resultSchema,
        JsonNode defaultConfiguration,
        String description,
        Long thumbnailAssetId,
        Map<String, Long> assets) {}
