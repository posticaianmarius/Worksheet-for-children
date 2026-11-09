package com.worksheet.learning.delivery;

import com.worksheet.teaching.space.*;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "assignment_delivery")
public class AssignmentDelivery {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "batch_id", unique = true)
    java.util.UUID batchId;

    @Column(name = "space_id")
    Long spaceId;

    @Column(name = "creator_id")
    Long creatorId;

    @Column(name = "classroom_id")
    Long classroomId;

    @Column(name = "revision_id")
    Long revisionId;

    @Column(name = "title")
    String title;

    @Column(name = "assigned_at")
    Instant assignedAt;

    @Column(name = "closed_at")
    Instant closedAt;

    public AssignmentDelivery() {}

    public Long getId() {
        return id;
    }

    public java.util.UUID getBatchId() {
        return batchId;
    }

    public Long getSpaceId() {
        return spaceId;
    }

    public Long getCreatorId() {
        return creatorId;
    }

    public Long getClassroomId() {
        return classroomId;
    }

    public Long getRevisionId() {
        return revisionId;
    }

    public String getTitle() {
        return title;
    }

    public Instant getAssignedAt() {
        return assignedAt;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public void close(Instant time) {
        closedAt = time;
    }
}
