package com.worksheet.teaching.space;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "space_invitation")
public class SpaceInvitation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "space_id")
    Long spaceId;

    @Column(name = "token_hash", unique = true, length = 64)
    String tokenHash;

    @Column(name = "expires_at")
    Instant expiresAt;

    @Column(name = "used_at")
    Instant usedAt;

    @Column(name = "revoked_at")
    Instant revokedAt;

    public SpaceInvitation() {}

    public Long getId() {
        return id;
    }

    public Long getSpaceId() {
        return spaceId;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }
}
