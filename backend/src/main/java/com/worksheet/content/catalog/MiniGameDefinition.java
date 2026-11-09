package com.worksheet.content.catalog;

import com.worksheet.auth.User;
import com.worksheet.content.catalog.asset.MiniGameAsset;

import jakarta.persistence.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;

import java.time.Instant;

// comment

@Entity
@Table(name = "mini_game_definition")
public class MiniGameDefinition {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, length = 100)
    private String type;

    @Column(nullable = false)
    private int version;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "configuration_schema", nullable = false)
    private JsonNode configurationSchema;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_schema", nullable = false)
    private JsonNode resultSchema;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "default_configuration", nullable = false)
    private JsonNode defaultConfiguration;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "thumbnail_asset_id")
    private MiniGameAsset thumbnailAsset;

    @Column(nullable = false)
    private boolean active;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected MiniGameDefinition() {}

    public MiniGameDefinition(
            String name, String type, JsonNode configurationSchema, boolean active) {
        this(
                name,
                type,
                1,
                configurationSchema,
                JsonNodeFactory.instance.objectNode(),
                JsonNodeFactory.instance.objectNode(),
                null,
                active);
    }

    public MiniGameDefinition(
            String name,
            String type,
            int version,
            JsonNode configurationSchema,
            JsonNode resultSchema,
            JsonNode defaultConfiguration,
            User owner,
            boolean active) {
        this.name = name;
        this.type = type;
        this.version = version;
        this.configurationSchema = configurationSchema;
        this.resultSchema = resultSchema;
        this.defaultConfiguration = defaultConfiguration;
        this.owner = owner;
        this.active = active;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getType() {
        return type;
    }

    public int getVersion() {
        return version;
    }

    public JsonNode getConfigurationSchema() {
        return configurationSchema;
    }

    public JsonNode getResultSchema() {
        return resultSchema;
    }

    public JsonNode getDefaultConfiguration() {
        return defaultConfiguration;
    }

    public User getOwner() {
        return owner;
    }

    public MiniGameAsset getThumbnailAsset() {
        return thumbnailAsset;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void update(
            String name,
            JsonNode configurationSchema,
            JsonNode resultSchema,
            JsonNode defaultConfiguration) {
        this.name = name;
        this.configurationSchema = configurationSchema;
        this.resultSchema = resultSchema;
        this.defaultConfiguration = defaultConfiguration;
        this.updatedAt = Instant.now();
    }

    public void updateCatalogMetadata(String description, MiniGameAsset thumbnailAsset) {
        this.description = description;
        this.thumbnailAsset = thumbnailAsset;
        this.updatedAt = Instant.now();
    }

    public void activate() {
        this.active = true;
        this.updatedAt = Instant.now();
    }

    public void deactivate() {
        this.active = false;
        this.updatedAt = Instant.now();
    }
}
