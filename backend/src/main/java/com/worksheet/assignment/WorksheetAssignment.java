package com.worksheet.assignment;

import com.worksheet.auth.User;
import com.worksheet.classroom.Classroom;
import com.worksheet.worksheet.revision.WorksheetRevision;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "worksheet_assignment", uniqueConstraints = @UniqueConstraint(columnNames = {"batch_id", "user_id"}))
public class WorksheetAssignment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "space_id")
    private Long spaceId;

    @Column(name = "batch_id", nullable = false)
    private UUID batchId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worksheet_revision_id", nullable = false)
    private WorksheetRevision worksheetRevision;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classroom_id")
    private Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "removed_at")
    private Instant removedAt;

    protected WorksheetAssignment() {}

    public WorksheetAssignment(UUID batchId, WorksheetRevision worksheetRevision,
                               Classroom classroom, User user) {
        this.batchId = batchId;
        this.worksheetRevision = worksheetRevision;
        this.classroom = classroom;
        this.user = user;
        this.assignedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getSpaceId() { return spaceId; }
    public void setSpaceId(Long value) { spaceId = value; }
    public UUID getBatchId() { return batchId; }
    public WorksheetRevision getWorksheetRevision() { return worksheetRevision; }
    public User getTeacher() { return worksheetRevision.getWorksheet().getUser(); }
    public Classroom getClassroom() { return classroom; }
    public User getUser() { return user; }
    public Instant getAssignedAt() { return assignedAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public Instant getRemovedAt() { return removedAt; }
    public void remove() {
        revoke();
        if (removedAt == null) removedAt = Instant.now();
    }
    public void revoke() { if(revokedAt == null) revokedAt = Instant.now(); }
}
