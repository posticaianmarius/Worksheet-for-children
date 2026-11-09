package com.worksheet.learning.attempt;

import tools.jackson.databind.JsonNode;

public record AttemptItemResultResponse(
        Long id,
        Long revisionItemId,
        ItemResultOutcome outcome,
        int score,
        int maxScore,
        int timeSeconds,
        JsonNode details) {}
