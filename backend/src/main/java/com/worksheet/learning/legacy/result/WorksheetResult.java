package com.worksheet.learning.legacy.result;

import com.worksheet.content.worksheet.Worksheet;
import com.worksheet.learning.assignment.WorksheetAssignment;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "worksheet_result")
public class WorksheetResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worksheet_id", nullable = false)
    private Worksheet worksheet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignment_id")
    private WorksheetAssignment assignment;

    @Column(name = "total_score", nullable = false)
    private int totalScore;

    @Column(name = "max_score", nullable = false)
    private int maxScore;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    protected WorksheetResult() {}

    public WorksheetResult(Worksheet worksheet, int totalScore, int maxScore) {
        this(worksheet, null, totalScore, maxScore);
    }

    public WorksheetResult(
            Worksheet worksheet, WorksheetAssignment assignment, int totalScore, int maxScore) {
        this.worksheet = worksheet;
        this.assignment = assignment;
        this.totalScore = totalScore;
        this.maxScore = maxScore;
        this.completedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Worksheet getWorksheet() {
        return worksheet;
    }

    public WorksheetAssignment getAssignment() {
        return assignment;
    }

    public int getTotalScore() {
        return totalScore;
    }

    public int getMaxScore() {
        return maxScore;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void updateScores(int totalScore, int maxScore) {
        this.totalScore = totalScore;
        this.maxScore = maxScore;
    }
}
