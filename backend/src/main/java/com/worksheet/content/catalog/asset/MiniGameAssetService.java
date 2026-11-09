package com.worksheet.content.catalog.asset;

import com.worksheet.auth.User;
import com.worksheet.auth.UserRole;
import com.worksheet.content.catalog.MiniGameDefinitionAssetRepository;
import com.worksheet.content.catalog.MiniGameDefinitionRepository;
import com.worksheet.shared.storage.MiniGameAssetStorage;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class MiniGameAssetService {
    private final com.worksheet.content.catalog.ContentReferences references;
    public static final long MAX_SIZE = 10L * 1024 * 1024;
    private final MiniGameAssetRepository repository;
    private final MiniGameDefinitionAssetRepository definitionAssets;
    private final MiniGameAssetStorage storage;
    private final AssetContentInspector inspector;
    private final MiniGameDefinitionRepository definitions;

    public MiniGameAssetService(
            MiniGameAssetRepository repository,
            MiniGameDefinitionAssetRepository definitionAssets,
            MiniGameAssetStorage storage,
            AssetContentInspector inspector,
            MiniGameDefinitionRepository definitions,
            com.worksheet.content.catalog.ContentReferences references) {
        this.references = references;
        this.repository = repository;
        this.definitionAssets = definitionAssets;
        this.storage = storage;
        this.inspector = inspector;
        this.definitions = definitions;
    }

    @Transactional
    public MiniGameAssetResponse store(User creator, MultipartFile file) {
        return store(creator, file, false);
    }

    public MiniGameAssetResponse storeImage(User creator, MultipartFile file) {
        return store(creator, file, true);
    }

    private MiniGameAssetResponse store(User creator, MultipartFile file, boolean imageOnly) {
        if (file == null || file.isEmpty()) throw badRequest("Asset file is required.");
        if (file.getSize() > MAX_SIZE) throw badRequest("Asset cannot exceed 10 MB.");
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException error) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Could not read asset file.", error);
        }
        AssetContentInspector.InspectedAsset inspected = inspector.inspect(bytes);
        if (imageOnly && !inspected.contentType().startsWith("image/")) {
            throw badRequest("Task uploads must be PNG, JPEG, GIF, or WebP images.");
        }
        String key = UUID.randomUUID() + inspected.extension();
        storage.store(key, bytes);
        try {
            MiniGameAsset asset =
                    repository.save(
                            new MiniGameAsset(
                                    creator,
                                    safeName(file.getOriginalFilename()),
                                    key,
                                    inspected.contentType(),
                                    bytes.length,
                                    sha256(bytes)));
            return response(asset);
        } catch (RuntimeException error) {
            storage.delete(key);
            throw error;
        }
    }

    public MiniGameAssetContent load(Long id) {
        MiniGameAsset asset = requireActive(id);
        return new MiniGameAssetContent(
                storage.load(asset.getStorageKey()),
                asset.getContentType(),
                asset.getOriginalFilename());
    }

    public MiniGameAsset requireActive(Long id) {
        return repository
                .findByIdAndStatus(id, MiniGameAssetStatus.ACTIVE)
                .orElseThrow(
                        () ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND, "Asset not found."));
    }

    public MiniGameAsset lockActive(Long id) {
        if (id == null || id < 1) throw badRequest("Asset ID must be a positive integer.");
        return repository
                .lockByIdAndStatus(id, MiniGameAssetStatus.ACTIVE)
                .orElseThrow(
                        () ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND, "Asset not found."));
    }

    public record ImagePage(
            List<MiniGameAssetResponse> items, int page, int size, long totalElements) {}

    @Transactional(readOnly = true)
    public ImagePage listImages(Long ownerId, int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw badRequest("Page must be nonnegative and size between 1 and 100.");
        var result =
                repository.findByOwner_IdAndStatusAndContentTypeStartingWith(
                        ownerId,
                        MiniGameAssetStatus.ACTIVE,
                        "image/",
                        PageRequest.of(page, size, Sort.by("id").descending()));
        return new ImagePage(
                result.stream().map(this::response).toList(),
                page,
                size,
                result.getTotalElements());
    }

    @Transactional
    public void delete(Long id, User actor) {
        MiniGameAsset asset = lockActive(id);
        if (actor.getRole() != UserRole.ADMIN && !asset.getOwner().getId().equals(actor.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "You can only delete your own uploads.");
        }
        if (definitionAssets.existsByAsset_Id(id)
                || definitions.existsByThumbnailAsset_Id(id)
                || references.assetInUse(id)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Asset is referenced by a mini-game, worksheet task, or published revision.");
        }
        storage.delete(asset.getStorageKey());
        asset.markDeleted();
        repository.save(asset);
    }

    private MiniGameAssetResponse response(MiniGameAsset asset) {
        String url =
                asset.getStatus() == MiniGameAssetStatus.ACTIVE
                        ? "/api/minigame-assets/" + asset.getId() + "/content"
                        : null;
        return new MiniGameAssetResponse(
                asset.getId(),
                asset.getOriginalFilename(),
                asset.getContentType(),
                asset.getSizeBytes(),
                asset.getSha256(),
                asset.getStatus(),
                url,
                asset.getCreatedAt());
    }

    private String safeName(String name) {
        String safe = name == null ? "asset" : name.replace('\\', '/');
        safe = safe.substring(safe.lastIndexOf('/') + 1).trim();
        if (safe.isEmpty()) safe = "asset";
        return safe.length() > 255 ? safe.substring(safe.length() - 255) : safe;
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable.", impossible);
        }
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
