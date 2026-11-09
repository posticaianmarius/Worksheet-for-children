package com.worksheet.content.catalog.asset;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** The root schema extension is independent of JSON Schema's $ref/conditional evaluation. */
@Component
public class ImageSlotPolicy {
    public static final String KEYWORD = "x-image-slots";
    private static final Set<String> FIELDS = Set.of("path", "label", "allowUpload", "variants");

    public record Slot(
            String key, String path, String label, boolean allowUpload, List<String> variants) {}

    public List<Slot> parse(JsonNode schema) {
        JsonNode declarations = schema.get(KEYWORD);
        if (declarations == null) return List.of();
        if (!declarations.isObject() || declarations.size() > 32) {
            throw invalid("must be an object with at most 32 slots");
        }
        List<Slot> slots = new ArrayList<>();
        Set<String> paths = new HashSet<>();
        for (String key : declarations.propertyNames()) {
            JsonNode slot = declarations.get(key);
            if (!key.matches("[a-z0-9]+(?:[._-][a-z0-9]+)*")
                    || key.length() > 100
                    || !slot.isObject()
                    || !FIELDS.containsAll(slot.propertyNames()))
                throw invalid("invalid slot " + key);
            JsonNode path = slot.get("path");
            if (path == null
                    || !path.isString()
                    || path.asString().length() > 500
                    || !path.asString().matches("(?:/(?:[A-Za-z_][A-Za-z0-9_-]*|\\*))+")) {
                throw invalid(
                        key
                                + ": path must contain property names or array wildcards, e.g."
                                + " /tasks/*/imageAssetId");
            }
            if (!paths.add(path.asString()))
                throw invalid("duplicate slot path " + path.asString());
            JsonNode label = slot.get("label");
            if (label != null
                    && (!label.isString()
                            || label.asString().isBlank()
                            || label.asString().length() > 100)) {
                throw invalid(key + ": label must be nonblank text of at most 100 characters");
            }
            JsonNode upload = slot.get("allowUpload");
            if (upload != null && !upload.isBoolean())
                throw invalid(key + ": allowUpload must be boolean");
            List<String> variants = new ArrayList<>();
            JsonNode options = slot.get("variants");
            if (options != null) {
                if (!options.isArray() || options.size() > 100)
                    throw invalid(
                            key + ": variants must be an array of at most 100 catalog asset keys");
                for (JsonNode option : options) {
                    if (!option.isString()
                            || !option.asString().matches("[a-z0-9]+(?:[._-][a-z0-9]+)*")
                            || option.asString().length() > 100
                            || variants.contains(option.asString())) {
                        throw invalid(key + ": invalid or duplicate variant key");
                    }
                    variants.add(option.asString());
                }
            }
            boolean allowUpload = upload != null && upload.asBoolean();
            if (!allowUpload && variants.isEmpty())
                throw invalid(key + ": enable uploads or supply variants");
            slots.add(
                    new Slot(
                            key,
                            path.asString(),
                            label == null ? key : label.asString(),
                            allowUpload,
                            List.copyOf(variants)));
        }
        return List.copyOf(slots);
    }

    public List<Long> assetIds(Slot slot, JsonNode configuration) {
        List<Long> ids = new ArrayList<>();
        collect(configuration, slot.path().substring(1).split("/"), 0, ids, slot.key());
        return ids;
    }

    private void collect(JsonNode value, String[] path, int index, List<Long> ids, String key) {
        if (value == null || value.isNull())
            return; // Required/nullable is controlled by JSON Schema.
        if (index == path.length) {
            if (!value.isIntegralNumber() || !value.canConvertToLong() || value.asLong() < 1) {
                throw invalid(key + ": image references must be positive integer asset IDs");
            }
            ids.add(value.asLong());
        } else if (path[index].equals("*")) {
            if (!value.isArray()) throw invalid(key + ": wildcard requires an array");
            for (JsonNode element : value) collect(element, path, index + 1, ids, key);
        } else {
            if (!value.isObject()) throw invalid(key + ": path requires an object");
            collect(value.get(path[index]), path, index + 1, ids, key);
        }
    }

    private ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, KEYWORD + ": " + message);
    }
}
