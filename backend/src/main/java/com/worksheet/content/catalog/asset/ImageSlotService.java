package com.worksheet.content.catalog.asset;

import com.worksheet.auth.User;
import com.worksheet.content.catalog.MiniGameDefinition;
import com.worksheet.content.catalog.MiniGameDefinitionAssetRepository;
import com.worksheet.content.catalog.MiniGameDefinitionRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

@Service
@Transactional
public class ImageSlotService {
    private final ImageSlotPolicy policy;
    private final MiniGameDefinitionRepository definitions;
    private final MiniGameDefinitionAssetRepository catalog;
    private final MiniGameAssetService assets;

    public ImageSlotService(
            ImageSlotPolicy policy,
            MiniGameDefinitionRepository definitions,
            MiniGameDefinitionAssetRepository catalog,
            MiniGameAssetService assets) {
        this.policy = policy;
        this.definitions = definitions;
        this.catalog = catalog;
        this.assets = assets;
    }

    public record Variant(
            String key, Long assetId, String filename, String contentType, String url) {}

    public record SlotResponse(
            String key,
            String path,
            String label,
            boolean allowUpload,
            List<String> acceptedContentTypes,
            long maxUploadBytes,
            List<Variant> variants) {}

    @Transactional(readOnly = true)
    public List<SlotResponse> describe(Long definitionId) {
        MiniGameDefinition definition = activeDefinition(definitionId);
        Map<String, MiniGameAsset> variants = new LinkedHashMap<>();
        catalog.findByDefinition_IdOrderByAssetKey(definitionId)
                .forEach(link -> variants.put(link.getAssetKey(), link.getAsset()));
        return policy.parse(definition.getConfigurationSchema()).stream()
                .map(
                        slot ->
                                new SlotResponse(
                                        slot.key(),
                                        slot.path(),
                                        slot.label(),
                                        slot.allowUpload(),
                                        List.of(
                                                "image/png",
                                                "image/jpeg",
                                                "image/gif",
                                                "image/webp"),
                                        MiniGameAssetService.MAX_SIZE,
                                        slot.variants().stream()
                                                .map(
                                                        key -> {
                                                            MiniGameAsset asset = variants.get(key);
                                                            return new Variant(
                                                                    key,
                                                                    asset.getId(),
                                                                    asset.getOriginalFilename(),
                                                                    asset.getContentType(),
                                                                    "/api/minigame-assets/"
                                                                            + asset.getId()
                                                                            + "/content");
                                                        })
                                                .toList()))
                .toList();
    }

    public MiniGameAssetResponse upload(
            Long definitionId, String slotKey, User teacher, MultipartFile file) {
        ImageSlotPolicy.Slot slot =
                policy.parse(activeDefinition(definitionId).getConfigurationSchema()).stream()
                        .filter(value -> value.key().equals(slotKey))
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND, "Image slot not found."));
        if (!slot.allowUpload())
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "This image slot accepts catalog variants only.");
        return assets.storeImage(teacher, file);
    }

    public void validateDefinition(
            JsonNode schema, JsonNode defaults, Map<String, Long> requestedAssets) {
        List<ImageSlotPolicy.Slot> slots = policy.parse(schema);
        Map<String, Long> variants = requestedAssets == null ? Map.of() : requestedAssets;
        Set<Long> ids = new TreeSet<>();
        for (ImageSlotPolicy.Slot slot : slots) {
            for (String key : slot.variants()) {
                Long id = variants.get(key);
                if (id == null || id < 1)
                    throw invalid("Image variant must name a linked catalog asset: " + key);
                ids.add(id);
            }
            Set<Long> allowed = variantIds(slot, variants);
            for (Long id : policy.assetIds(slot, defaults)) {
                if (!allowed.contains(id))
                    throw invalid(
                            "Default images must be declared catalog variants for slot "
                                    + slot.key());
            }
        }
        for (Long id : ids) requireImage(assets.lockActive(id));
    }

    /**
     * Validates only declared image fields; normal configuration validation remains JSON Schema's
     * job.
     */
    public Set<MiniGameAsset> resolve(
            MiniGameDefinition definition, JsonNode configuration, Long ownerId) {
        List<ImageSlotPolicy.Slot> slots = policy.parse(definition.getConfigurationSchema());
        if (slots.isEmpty()) return Set.of();
        Map<String, Long> variants = new LinkedHashMap<>();
        catalog.findByDefinition_IdOrderByAssetKey(definition.getId())
                .forEach(link -> variants.put(link.getAssetKey(), link.getAsset().getId()));
        Map<ImageSlotPolicy.Slot, List<Long>> requested = new LinkedHashMap<>();
        Set<Long> ids = new TreeSet<>();
        for (ImageSlotPolicy.Slot slot : slots) {
            List<Long> values = policy.assetIds(slot, configuration);
            requested.put(slot, values);
            ids.addAll(values);
        }
        Map<Long, MiniGameAsset> resolved = new LinkedHashMap<>();
        // Serialize reference creation and deletion, acquiring multiple asset locks in ID order.
        for (Long id : ids) {
            MiniGameAsset asset = assets.lockActive(id);
            requireImage(asset);
            resolved.put(id, asset);
        }
        requested.forEach(
                (slot, values) -> {
                    Set<Long> allowed = variantIds(slot, variants);
                    for (Long id : values) {
                        MiniGameAsset asset = resolved.get(id);
                        if (!allowed.contains(id)
                                && !(slot.allowUpload()
                                        && asset.getOwner().getId().equals(ownerId))) {
                            throw invalid(
                                    "Image is not an allowed variant or your own upload for slot "
                                            + slot.key());
                        }
                    }
                });
        return new LinkedHashSet<>(resolved.values());
    }

    private Set<Long> variantIds(ImageSlotPolicy.Slot slot, Map<String, Long> catalogAssets) {
        Set<Long> result = new LinkedHashSet<>();
        slot.variants().forEach(key -> result.add(catalogAssets.get(key)));
        return result;
    }

    private void requireImage(MiniGameAsset asset) {
        if (!asset.getContentType().startsWith("image/"))
            throw invalid("Image slots only accept image assets.");
    }

    private MiniGameDefinition activeDefinition(Long id) {
        return definitions
                .findById(id)
                .filter(MiniGameDefinition::isActive)
                .orElseThrow(
                        () ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND, "Mini-game not found."));
    }

    private ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
