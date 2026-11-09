package com.worksheet.content.catalog;

import com.worksheet.auth.User;
import com.worksheet.content.catalog.asset.ImageSlotService;
import com.worksheet.content.catalog.asset.MiniGameAsset;
import com.worksheet.content.catalog.asset.MiniGameAssetService;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class MiniGameDefinitionService {
    private final com.worksheet.content.catalog.ContentReferences references;
    private final MiniGameDefinitionRepository repository;
    private final MiniGameDefinitionAssetRepository definitionAssets;
    private final MiniGameAssetService assets;
    private final JsonSchemaValidationService schemaValidator;
    private final ImageSlotService imageSlots;

    public MiniGameDefinitionService(
            MiniGameDefinitionRepository repository,
            MiniGameDefinitionAssetRepository definitionAssets,
            MiniGameAssetService assets,
            JsonSchemaValidationService schemaValidator,
            ImageSlotService imageSlots,
            com.worksheet.content.catalog.ContentReferences references) {
        this.references = references;
        this.repository = repository;
        this.definitionAssets = definitionAssets;
        this.assets = assets;
        this.schemaValidator = schemaValidator;
        this.imageSlots = imageSlots;
    }

    @Transactional(readOnly = true)
    public List<MiniGameDefinitionResponse> getActive() {
        return repository.findByActiveTrueOrderByTypeAscVersionDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MiniGameDefinitionResponse> getAllForAdmin() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public MiniGameDefinitionResponse get(Long id) {
        MiniGameDefinition definition = repository.findById(id).orElseThrow(() -> notFound());
        if (!definition.isActive()) throw notFound();
        return toResponse(definition);
    }

    @Transactional
    public MiniGameDefinitionResponse create(
            User creator, CreateMiniGameDefinitionRequest request) {
        String name = requireText(request.name(), "Name", 100);
        String type = requireText(request.type(), "Type", 100).toLowerCase(Locale.ROOT);
        if (!type.matches("[a-z0-9]+(?:[._-][a-z0-9]+)*")) {
            throw badRequest(
                    "Type may contain lowercase letters, numbers, dots, underscores, and hyphens.");
        }
        int version = request.version() == null ? 1 : request.version();
        if (version < 1) throw badRequest("Version must be at least 1.");
        if (repository.existsByTypeIgnoreCaseAndVersion(type, version)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "That mini-game type and version already exist.");
        }
        JsonNode configurationSchema = schemaOrEmpty(request.configurationSchema());
        JsonNode resultSchema = schemaOrEmpty(request.resultSchema());
        JsonNode defaults = valueOrEmpty(request.defaultConfiguration());
        validateDefinition(configurationSchema, resultSchema, defaults);
        imageSlots.validateDefinition(configurationSchema, defaults, request.assets());

        MiniGameDefinition definition =
                new MiniGameDefinition(
                        name,
                        type,
                        version,
                        configurationSchema,
                        resultSchema,
                        defaults,
                        creator,
                        true);
        definition.updateCatalogMetadata(
                optionalText(request.description(), 500),
                optionalAsset(request.thumbnailAssetId()));
        definition = repository.save(definition);
        replaceAssetLinks(definition, request.assets());
        return toResponse(definition);
    }

    @Transactional
    public MiniGameDefinitionResponse update(Long id, UpdateMiniGameDefinitionRequest request) {
        MiniGameDefinition definition = requireMutable(id);
        String name = requireText(request.name(), "Name", 100);
        JsonNode configurationSchema = schemaOrEmpty(request.configurationSchema());
        JsonNode resultSchema = schemaOrEmpty(request.resultSchema());
        JsonNode defaults = valueOrEmpty(request.defaultConfiguration());
        validateDefinition(configurationSchema, resultSchema, defaults);
        imageSlots.validateDefinition(configurationSchema, defaults, request.assets());
        definition.update(name, configurationSchema, resultSchema, defaults);
        definition.updateCatalogMetadata(
                optionalText(request.description(), 500),
                optionalAsset(request.thumbnailAssetId()));
        repository.save(definition);
        replaceAssetLinks(definition, request.assets());
        return toResponse(definition);
    }

    @Transactional
    public void deactivate(Long id) {
        MiniGameDefinition definition = repository.findById(id).orElseThrow(this::notFound);
        definition.deactivate();
        repository.save(definition);
    }

    @Transactional
    public MiniGameDefinitionResponse activate(Long id) {
        MiniGameDefinition definition = repository.findById(id).orElseThrow(this::notFound);
        definition.activate();
        return toResponse(repository.save(definition));
    }

    private MiniGameDefinition requireMutable(Long id) {
        MiniGameDefinition definition = repository.findById(id).orElseThrow(this::notFound);
        if (references.definitionInUse(id)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A referenced mini-game version is immutable. Create a new version instead.");
        }
        return definition;
    }

    private void replaceAssetLinks(MiniGameDefinition definition, Map<String, Long> requested) {
        definitionAssets.deleteByDefinition_Id(definition.getId());
        // Release unique keys before inserting a replacement catalog for an unused definition.
        definitionAssets.flush();
        if (requested == null || requested.isEmpty()) return;
        List<MiniGameDefinitionAsset> links =
                requested.entrySet().stream()
                        .map(
                                entry -> {
                                    String key = requireText(entry.getKey(), "Asset key", 100);
                                    if (!key.matches("[a-z0-9]+(?:[._-][a-z0-9]+)*"))
                                        throw badRequest(
                                                "Asset keys must be stable lowercase identifiers.");
                                    MiniGameAsset asset = assets.lockActive(entry.getValue());
                                    return new MiniGameDefinitionAsset(definition, asset, key);
                                })
                        .toList();
        definitionAssets.saveAll(links);
    }

    private MiniGameAsset optionalAsset(Long id) {
        return id == null ? null : assets.lockActive(id);
    }

    private void validateDefinition(
            JsonNode configurationSchema, JsonNode resultSchema, JsonNode defaults) {
        schemaValidator.validateSchema(configurationSchema, "Configuration schema");
        schemaValidator.validateSchema(resultSchema, "Result schema");
        schemaValidator.validate(configurationSchema, defaults, "Default configuration");
    }

    private JsonNode schemaOrEmpty(JsonNode value) {
        return value == null ? JsonNodeFactory.instance.objectNode() : value;
    }

    private JsonNode valueOrEmpty(JsonNode value) {
        return value == null ? JsonNodeFactory.instance.objectNode() : value;
    }

    private String optionalText(String value, int max) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.strip();
        if (trimmed.length() > max) throw badRequest("Description is too long.");
        return trimmed;
    }

    private String requireText(String value, String field, int maxLength) {
        if (value == null || value.isBlank()) throw badRequest(field + " is required.");
        String trimmed = value.trim();
        if (trimmed.length() > maxLength) throw badRequest(field + " is too long.");
        return trimmed;
    }

    public MiniGameDefinitionResponse toResponse(MiniGameDefinition definition) {
        Map<String, String> assetUrls = new LinkedHashMap<>();
        definitionAssets
                .findByDefinition_IdOrderByAssetKey(definition.getId())
                .forEach(
                        link ->
                                assetUrls.put(
                                        link.getAssetKey(),
                                        "/api/minigame-assets/"
                                                + link.getAsset().getId()
                                                + "/content"));
        Long thumbnailId =
                definition.getThumbnailAsset() == null
                        ? null
                        : definition.getThumbnailAsset().getId();
        return new MiniGameDefinitionResponse(
                definition.getId(),
                definition.getName(),
                definition.getType(),
                definition.getVersion(),
                definition.getConfigurationSchema(),
                definition.getResultSchema(),
                definition.getDefaultConfiguration(),
                definition.getDescription(),
                thumbnailId,
                assetUrls,
                definition.isActive());
    }

    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Mini-game not found.");
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
