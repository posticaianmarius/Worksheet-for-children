package com.worksheet.learning.legacy.result.minigame;

import com.worksheet.content.worksheet.item.WorksheetItem;
import com.worksheet.learning.legacy.result.WorksheetResult;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import tools.jackson.databind.JsonNode;

@Entity
@Table(name = "mini_game_result")
public class MiniGameResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worksheet_result_id", nullable = false)
    private WorksheetResult worksheetResult;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worksheet_item_id", nullable = false)
    private WorksheetItem worksheetItem;

    @Column(nullable = false)
    private int score;

    @Column(name = "max_score", nullable = false)
    private int maxScore;

    @Column(name = "time_seconds", nullable = false)
    private int timeSeconds;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private JsonNode details;

    protected MiniGameResult() {}

    public MiniGameResult(
            WorksheetResult worksheetResult,
            WorksheetItem worksheetItem,
            int score,
            int maxScore,
            int timeSeconds,
            JsonNode details) {
        this.worksheetResult = worksheetResult;
        this.worksheetItem = worksheetItem;
        this.score = score;
        this.maxScore = maxScore;
        this.timeSeconds = timeSeconds;
        this.details = details;
    }

    public Long getId() {
        return id;
    }

    public WorksheetResult getWorksheetResult() {
        return worksheetResult;
    }

    public WorksheetItem getWorksheetItem() {
        return worksheetItem;
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
            WorksheetItem worksheetItem,
            int score,
            int maxScore,
            int timeSeconds,
            JsonNode details) {
        this.worksheetItem = worksheetItem;
        this.score = score;
        this.maxScore = maxScore;
        this.timeSeconds = timeSeconds;
        this.details = details;
    }
}
