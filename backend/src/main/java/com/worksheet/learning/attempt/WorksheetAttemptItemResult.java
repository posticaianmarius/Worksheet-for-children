package com.worksheet.learning.attempt;

import com.worksheet.content.worksheet.revision.WorksheetRevisionItem;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import tools.jackson.databind.JsonNode;

@Entity
@Table(
        name = "worksheet_attempt_item_result",
        uniqueConstraints =
                @UniqueConstraint(
                        columnNames = {"worksheet_attempt_id", "worksheet_revision_item_id"}))
public class WorksheetAttemptItemResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worksheet_attempt_id", nullable = false)
    private WorksheetAttempt attempt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worksheet_revision_item_id", nullable = false)
    private WorksheetRevisionItem revisionItem;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ItemResultOutcome outcome;

    @Column(nullable = false)
    private int score;

    @Column(nullable = false)
    private int maxScore;

    @Column(nullable = false)
    private int timeSeconds;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private JsonNode details;

    protected WorksheetAttemptItemResult() {}

    public WorksheetAttemptItemResult(
            WorksheetAttempt attempt,
            WorksheetRevisionItem revisionItem,
            ItemResultOutcome outcome,
            int score,
            int maxScore,
            int timeSeconds,
            JsonNode details) {
        this.attempt = attempt;
        this.revisionItem = revisionItem;
        update(outcome, score, maxScore, timeSeconds, details);
    }

    public Long getId() {
        return id;
    }

    public WorksheetAttempt getAttempt() {
        return attempt;
    }

    public WorksheetRevisionItem getRevisionItem() {
        return revisionItem;
    }

    public ItemResultOutcome getOutcome() {
        return outcome;
    }

    public int getScore() {
        return score;
    }

    public int getMaxScore() {
        return maxScore;
    }

    public int getTimeSeconds() {
        return timeSeconds;
    }

    public JsonNode getDetails() {
        return details;
    }

    public void update(
            ItemResultOutcome outcome, int score, int maxScore, int timeSeconds, JsonNode details) {
        this.outcome = outcome;
        this.score = score;
        this.maxScore = maxScore;
        this.timeSeconds = timeSeconds;
        this.details = details;
    }
}
