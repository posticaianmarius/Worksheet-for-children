package com.worksheet.content.worksheet.item;

import com.worksheet.content.catalog.MiniGameDefinition;
import com.worksheet.content.catalog.asset.MiniGameAsset;
import com.worksheet.content.worksheet.Worksheet;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import tools.jackson.databind.JsonNode;

import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "worksheet_item")
public class WorksheetItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "worksheet_id", nullable = false)
    private Worksheet worksheet;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mini_game_id", nullable = false)
    private MiniGameDefinition miniGame;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private JsonNode configuration;

    @ManyToMany
    @JoinTable(
            name = "worksheet_item_image_asset",
            joinColumns = @JoinColumn(name = "worksheet_item_id"),
            inverseJoinColumns = @JoinColumn(name = "mini_game_asset_id"))
    private Set<MiniGameAsset> imageAssets = new LinkedHashSet<>();

    protected WorksheetItem() {}

    public WorksheetItem(
            Worksheet worksheet,
            MiniGameDefinition miniGame,
            int orderIndex,
            JsonNode configuration) {
        this.worksheet = worksheet;
        this.miniGame = miniGame;
        this.orderIndex = orderIndex;
        this.configuration = configuration;
    }

    public Long getId() {
        return id;
    }

    public Worksheet getWorksheet() {
        return worksheet;
    }

    public MiniGameDefinition getMiniGame() {
        return miniGame;
    }

    public int getOrderIndex() {
        return orderIndex;
    }

    public JsonNode getConfiguration() {
        return configuration;
    }

    public Set<MiniGameAsset> getImageAssets() {
        return Set.copyOf(imageAssets);
    }

    public void replaceImageAssets(Set<MiniGameAsset> assets) {
        imageAssets.clear();
        imageAssets.addAll(assets);
    }

    public void update(MiniGameDefinition miniGame, int orderIndex, JsonNode configuration) {
        this.miniGame = miniGame;
        this.orderIndex = orderIndex;
        this.configuration = configuration;
    }
}
