package com.worksheet.content.worksheet.revision;

import com.worksheet.content.catalog.asset.MiniGameAsset;
import com.worksheet.content.catalog.asset.MiniGameAssetService;
import com.worksheet.content.worksheet.Worksheet;
import com.worksheet.content.worksheet.item.WorksheetItem;
import com.worksheet.content.worksheet.item.WorksheetItemRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.JsonNode;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.List;

@Service
public class WorksheetRevisionService {
    private final WorksheetRevisionRepository revisions;
    private final WorksheetRevisionItemRepository revisionItems;
    private final WorksheetItemRepository worksheetItems;
    private final MiniGameAssetService assets;

    public WorksheetRevisionService(
            WorksheetRevisionRepository revisions,
            WorksheetRevisionItemRepository revisionItems,
            WorksheetItemRepository worksheetItems,
            MiniGameAssetService assets) {
        this.revisions = revisions;
        this.revisionItems = revisionItems;
        this.worksheetItems = worksheetItems;
        this.assets = assets;
    }

    @Transactional
    public WorksheetRevision publish(Worksheet worksheet) {
        List<WorksheetItem> items =
                worksheetItems.findByWorksheet_IdOrderByOrderIndex(worksheet.getId());
        String contentHash = hash(worksheet.getName(), items);
        return revisions
                .findByWorksheet_IdAndContentHash(worksheet.getId(), contentHash)
                .or(
                        () ->
                                revisions
                                        .findFirstByWorksheet_IdOrderByRevisionNumberDesc(
                                                worksheet.getId())
                                        .filter(
                                                latest ->
                                                        hasSameSnapshot(latest, worksheet, items)))
                .orElseGet(() -> createRevision(worksheet, items, contentHash));
    }

    private boolean hasSameSnapshot(
            WorksheetRevision revision, Worksheet worksheet, List<WorksheetItem> currentItems) {
        if (!revision.getNameSnapshot().equals(worksheet.getName())) return false;
        List<WorksheetRevisionItem> snapshot =
                revisionItems.findByRevision_IdOrderByOrderIndex(revision.getId());
        if (snapshot.size() != currentItems.size()) return false;
        for (int index = 0; index < snapshot.size(); index++) {
            WorksheetRevisionItem frozen = snapshot.get(index);
            WorksheetItem current = currentItems.get(index);
            if (frozen.getOrderIndex() != current.getOrderIndex()
                    || !frozen.getMiniGameDefinition().getId().equals(current.getMiniGame().getId())
                    || !canonicalJson(frozen.getConfiguration())
                            .equals(canonicalJson(current.getConfiguration()))) {
                return false;
            }
        }
        return true;
    }

    private WorksheetRevision createRevision(
            Worksheet worksheet, List<WorksheetItem> items, String contentHash) {
        // Protect snapshot references against concurrent draft edits followed by asset deletion.
        items.stream()
                .flatMap(item -> item.getImageAssets().stream())
                .map(MiniGameAsset::getId)
                .distinct()
                .sorted()
                .forEach(assets::lockActive);
        int nextNumber =
                revisions
                        .findFirstByWorksheet_IdOrderByRevisionNumberDesc(worksheet.getId())
                        .map(value -> value.getRevisionNumber() + 1)
                        .orElse(1);
        WorksheetRevision revision =
                revisions.save(
                        new WorksheetRevision(
                                worksheet, nextNumber, worksheet.getName(), contentHash));
        revisionItems.saveAll(
                items.stream().map(item -> new WorksheetRevisionItem(revision, item)).toList());
        return revision;
    }

    private String hash(String worksheetName, List<WorksheetItem> items) {
        StringBuilder canonical = new StringBuilder(worksheetName).append('\n');
        items.stream()
                .sorted(Comparator.comparingInt(WorksheetItem::getOrderIndex))
                .forEach(
                        item ->
                                canonical
                                        .append(item.getOrderIndex())
                                        .append('|')
                                        .append(item.getMiniGame().getId())
                                        .append('|')
                                        .append(canonicalJson(item.getConfiguration()))
                                        .append('\n'));
        try {
            byte[] digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(canonical.toString().getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable.", impossible);
        }
    }

    private String canonicalJson(JsonNode node) {
        if (node == null) return "null";
        if (node.isObject()) {
            return node.propertyNames().stream()
                    .sorted()
                    .map(name -> quote(name) + ":" + canonicalJson(node.get(name)))
                    .collect(java.util.stream.Collectors.joining(",", "{", "}"));
        }
        if (node.isArray()) {
            return node.valueStream()
                    .map(this::canonicalJson)
                    .collect(java.util.stream.Collectors.joining(",", "[", "]"));
        }
        return node.toString();
    }

    private String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
