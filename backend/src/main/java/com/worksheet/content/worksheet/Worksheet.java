package com.worksheet.content.worksheet;

import com.worksheet.auth.User;
import com.worksheet.content.worksheet.revision.WorksheetRevision;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;

@Entity
@Table(name = "worksheet")
public class Worksheet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Column(name = "share_code", unique = true, length = 9)
    private String shareCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "share_revision_id")
    private WorksheetRevision shareRevision;

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    protected Worksheet() {}

    public Worksheet(String name, User user) {
        this.name = name;
        this.user = user;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public User getUser() {
        return user;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public String getShareCode() {
        return shareCode;
    }

    public WorksheetRevision getShareRevision() {
        return shareRevision;
    }

    public long getRowVersion() {
        return rowVersion;
    }

    public void setName(String name) {
        this.name = name;
        this.updatedAt = Instant.now();
    }

    public void share(String shareCode, WorksheetRevision shareRevision) {
        this.shareCode = shareCode;
        this.shareRevision = shareRevision;
        this.updatedAt = Instant.now();
    }
}
