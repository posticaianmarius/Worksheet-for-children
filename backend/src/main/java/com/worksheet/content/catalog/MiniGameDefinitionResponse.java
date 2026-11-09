package com.worksheet.content.catalog;

import tools.jackson.databind.JsonNode;

import java.util.Map;

public record MiniGameDefinitionResponse(
        Long id,
        String name,
        String type,
        int version,
        JsonNode configurationSchema,
        JsonNode resultSchema,
        JsonNode defaultConfiguration,
        String description,
        Long thumbnailAssetId,
        Map<String, String> assets,
        boolean active) {}
