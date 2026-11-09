package com.worksheet.learning.legacy.result.minigame;

import tools.jackson.databind.JsonNode;

public record MiniGameResultResponse(
        Long id,
        Long worksheetResultId,
        Long worksheetItemId,
        int score,
        int maxScore,
        int timeSeconds,
        JsonNode details) {}
