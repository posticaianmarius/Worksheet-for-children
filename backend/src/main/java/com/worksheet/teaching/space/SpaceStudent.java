package com.worksheet.teaching.space;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(
        name = "space_student",
        uniqueConstraints = @UniqueConstraint(columnNames = {"space_id", "user_id"}))
public class SpaceStudent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "space_id")
    Long spaceId;

    @Column(name = "user_id")
    Long userId;

    @Column(name = "name")
    String name;

    @Column(name = "archived_at")
    Instant archivedAt;

    @Column(name = "credential_version")
    long credentialVersion;

    public SpaceStudent() {}

    public Long getId() {
        return id;
    }

    public Long getSpaceId() {
        return spaceId;
    }

    public Long getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public Instant getArchivedAt() {
        return archivedAt;
    }

    public long getCredentialVersion() {
        return credentialVersion;
    }
}
