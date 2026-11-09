package com.worksheet.content.catalog.asset;

import java.time.Instant;

public record MiniGameAssetResponse(
        Long id,
        String originalFilename,
        String contentType,
        long sizeBytes,
        String sha256,
        MiniGameAssetStatus status,
        String url,
        Instant createdAt) {}
