package com.worksheet.learning.legacy.result.minigame;

import tools.jackson.databind.JsonNode;

public record CreateMiniGameResultRequest(
        Long worksheetItemId, int score, int maxScore, int timeSeconds, JsonNode details) {}
