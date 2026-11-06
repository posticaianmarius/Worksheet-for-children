package com.worksheet.space;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="space_invitation")
public class SpaceInvitation {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
 public Long id;
 @Column(name="space_id")
 public Long spaceId;
 @Column(name="token_hash", unique=true, length=64)
 public String tokenHash;
 @Column(name="expires_at")
 public Instant expiresAt;
 @Column(name="used_at")
 public Instant usedAt;
 @Column(name="revoked_at")
 public Instant revokedAt;
 public SpaceInvitation() {}
}

