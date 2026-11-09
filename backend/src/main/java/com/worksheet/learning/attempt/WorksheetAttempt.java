package com.worksheet.learning.attempt;

import com.worksheet.content.worksheet.revision.WorksheetRevision;
import com.worksheet.learning.assignment.WorksheetAssignment;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "worksheet_attempt")
public class WorksheetAttempt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worksheet_revision_id", nullable = false)
    private WorksheetRevision revision;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignment_id")
    private WorksheetAssignment assignment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AttemptStatus status;

    @Column(nullable = false)
    private int totalScore;

    @Column(nullable = false)
    private int maxScore;

    @Column(nullable = false)
    private Instant startedAt;

    private Instant completedAt;

    protected WorksheetAttempt() {}

    public WorksheetAttempt(WorksheetRevision revision, WorksheetAssignment assignment) {
        this.revision = revision;
        this.assignment = assignment;
        this.status = AttemptStatus.IN_PROGRESS;
        this.startedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public WorksheetRevision getRevision() {
        return revision;
    }

    public WorksheetAssignment getAssignment() {
        return assignment;
    }

    public AttemptStatus getStatus() {
        return status;
    }

    public int getTotalScore() {
        return totalScore;
    }

    public int getMaxScore() {
        return maxScore;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void complete(int totalScore, int maxScore) {
        this.totalScore = totalScore;
        this.maxScore = maxScore;
        this.status = AttemptStatus.COMPLETED;
        this.completedAt = Instant.now();
    }

    public void abandon() {
        if (status == AttemptStatus.IN_PROGRESS) status = AttemptStatus.ABANDONED;
    }
}
