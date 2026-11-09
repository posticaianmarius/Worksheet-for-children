package com.worksheet.content.catalog;

import tools.jackson.databind.JsonNode;

import java.util.Map;

public record CreateMiniGameDefinitionRequest(
        String name,
        String type,
        Integer version,
        JsonNode configurationSchema,
        JsonNode resultSchema,
        JsonNode defaultConfiguration,
        String description,
        Long thumbnailAssetId,
        Map<String, Long> assets) {}
