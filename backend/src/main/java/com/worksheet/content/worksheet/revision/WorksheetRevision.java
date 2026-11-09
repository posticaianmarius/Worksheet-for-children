package com.worksheet.content.worksheet.revision;

import com.worksheet.content.worksheet.Worksheet;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(
        name = "worksheet_revision",
        uniqueConstraints = {
            @UniqueConstraint(columnNames = {"worksheet_id", "revision_number"}),
            @UniqueConstraint(columnNames = {"worksheet_id", "content_hash"})
        })
public class WorksheetRevision {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worksheet_id", nullable = false)
    private Worksheet worksheet;

    @Column(name = "revision_number", nullable = false)
    private int revisionNumber;

    @Column(name = "name_snapshot", nullable = false, length = 150)
    private String nameSnapshot;

    @Column(name = "content_hash", nullable = false, length = 64)
    private String contentHash;

    @Column(name = "published_at", nullable = false)
    private Instant publishedAt;

    protected WorksheetRevision() {}

    public WorksheetRevision(
            Worksheet worksheet, int revisionNumber, String nameSnapshot, String contentHash) {
        this.worksheet = worksheet;
        this.revisionNumber = revisionNumber;
        this.nameSnapshot = nameSnapshot;
        this.contentHash = contentHash;
        this.publishedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Worksheet getWorksheet() {
        return worksheet;
    }

    public int getRevisionNumber() {
        return revisionNumber;
    }

    public String getNameSnapshot() {
        return nameSnapshot;
    }

    public String getContentHash() {
        return contentHash;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }
}
