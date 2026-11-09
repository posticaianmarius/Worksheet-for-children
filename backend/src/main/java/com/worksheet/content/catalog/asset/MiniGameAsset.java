package com.worksheet.content.catalog.asset;

import com.worksheet.auth.User;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mini_game_asset")
public class MiniGameAsset {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 255)
    private String originalFilename;

    @Column(nullable = false, unique = true, length = 255)
    private String storageKey;

    @Column(nullable = false, length = 100)
    private String contentType;

    @Column(nullable = false)
    private long sizeBytes;

    @Column(nullable = false, length = 64)
    private String sha256;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MiniGameAssetStatus status;

    @Column(nullable = false)
    private Instant createdAt;

    protected MiniGameAsset() {}

    public MiniGameAsset(
            User owner,
            String originalFilename,
            String storageKey,
            String contentType,
            long sizeBytes,
            String sha256) {
        this.owner = owner;
        this.originalFilename = originalFilename;
        this.storageKey = storageKey;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.sha256 = sha256;
        this.status = MiniGameAssetStatus.ACTIVE;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public User getOwner() {
        return owner;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public String getContentType() {
        return contentType;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public String getSha256() {
        return sha256;
    }

    public MiniGameAssetStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void markDeleted() {
        this.status = MiniGameAssetStatus.DELETED;
    }
}
