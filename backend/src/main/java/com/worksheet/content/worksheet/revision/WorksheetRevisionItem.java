package com.worksheet.content.worksheet.revision;

import com.worksheet.content.catalog.MiniGameDefinition;
import com.worksheet.content.catalog.asset.MiniGameAsset;
import com.worksheet.content.worksheet.item.WorksheetItem;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import tools.jackson.databind.JsonNode;

import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(
        name = "worksheet_revision_item",
        uniqueConstraints =
                @UniqueConstraint(columnNames = {"worksheet_revision_id", "order_index"}))
public class WorksheetRevisionItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worksheet_revision_id", nullable = false)
    private WorksheetRevision revision;

    @Column(name = "source_worksheet_item_id")
    private Long sourceWorksheetItemId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mini_game_definition_id", nullable = false)
    private MiniGameDefinition miniGameDefinition;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private JsonNode configuration;

    @ManyToMany
    @JoinTable(
            name = "worksheet_revision_item_image_asset",
            joinColumns = @JoinColumn(name = "worksheet_revision_item_id"),
            inverseJoinColumns = @JoinColumn(name = "mini_game_asset_id"))
    private Set<MiniGameAsset> imageAssets = new LinkedHashSet<>();

    protected WorksheetRevisionItem() {}

    public WorksheetRevisionItem(WorksheetRevision revision, WorksheetItem sourceItem) {
        this.revision = revision;
        this.sourceWorksheetItemId = sourceItem.getId();
        this.miniGameDefinition = sourceItem.getMiniGame();
        this.orderIndex = sourceItem.getOrderIndex();
        this.configuration = sourceItem.getConfiguration().deepCopy();
        this.imageAssets.addAll(sourceItem.getImageAssets());
    }

    public Long getId() {
        return id;
    }

    public WorksheetRevision getRevision() {
        return revision;
    }

    public Long getSourceWorksheetItemId() {
        return sourceWorksheetItemId;
    }

    public MiniGameDefinition getMiniGameDefinition() {
        return miniGameDefinition;
    }

    public int getOrderIndex() {
        return orderIndex;
    }

    public JsonNode getConfiguration() {
        return configuration;
    }
}
