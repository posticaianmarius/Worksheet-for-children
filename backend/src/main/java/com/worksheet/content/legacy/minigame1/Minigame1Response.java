package com.worksheet.content.legacy.minigame1;

import java.time.Instant;

public record Minigame1Response(Long id, String name, String imageUrl, Instant createdAt) {

    public static Minigame1Response from(Minigame1 minigame1) {
        return new Minigame1Response(
                minigame1.getId(),
                minigame1.getName(),
                "/api/minigame1/" + minigame1.getId() + "/image",
                minigame1.getCreatedAt());
    }
}
