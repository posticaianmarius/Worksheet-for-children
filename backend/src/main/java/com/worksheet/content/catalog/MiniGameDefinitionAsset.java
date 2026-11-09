package com.worksheet.content.catalog;

import com.worksheet.content.catalog.asset.MiniGameAsset;

import jakarta.persistence.*;

@Entity
@Table(
        name = "mini_game_definition_asset",
        uniqueConstraints = {
            @UniqueConstraint(columnNames = {"mini_game_definition_id", "asset_key"}),
            @UniqueConstraint(columnNames = {"mini_game_definition_id", "mini_game_asset_id"})
        })
public class MiniGameDefinitionAsset {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mini_game_definition_id", nullable = false)
    private MiniGameDefinition definition;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mini_game_asset_id", nullable = false)
    private MiniGameAsset asset;

    @Column(name = "asset_key", nullable = false, length = 100)
    private String assetKey;

    protected MiniGameDefinitionAsset() {}

    public MiniGameDefinitionAsset(
            MiniGameDefinition definition, MiniGameAsset asset, String assetKey) {
        this.definition = definition;
        this.asset = asset;
        this.assetKey = assetKey;
    }

    public Long getId() {
        return id;
    }

    public MiniGameDefinition getDefinition() {
        return definition;
    }

    public MiniGameAsset getAsset() {
        return asset;
    }

    public String getAssetKey() {
        return assetKey;
    }
}
