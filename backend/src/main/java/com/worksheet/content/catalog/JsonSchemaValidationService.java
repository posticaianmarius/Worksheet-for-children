package com.worksheet.content.catalog;

import com.networknt.schema.Error;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Standards-compliant JSON Schema Draft 2020-12 validation for mini-game contracts. */
@Service
public class JsonSchemaValidationService {
    private static final int MAX_CACHE_SIZE = 256;
    private final SchemaRegistry registry =
            SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12);
    private final Map<String, Schema> compiled = new ConcurrentHashMap<>();

    public void validateSchema(JsonNode schema, String label) {
        if (schema == null || (!schema.isObject() && !schema.isBoolean())) {
            badRequest(label + " must be a JSON Schema object or boolean.");
        }
        rejectRemoteReferences(schema, label);
        compile(schema, label);
    }

    public void validate(JsonNode schema, JsonNode value, String label) {
        validateSchema(schema, label + " schema");
        List<Error> errors = compile(schema, label + " schema").validate(value);
        if (!errors.isEmpty()) {
            String message =
                    errors.stream()
                            .limit(5)
                            .map(Error::getMessage)
                            .reduce((left, right) -> left + "; " + right)
                            .orElse("does not match its schema");
            badRequest(label + " is invalid: " + message);
        }
    }

    private Schema compile(JsonNode schema, String label) {
        String key = schema.toString();
        try {
            if (compiled.size() >= MAX_CACHE_SIZE && !compiled.containsKey(key)) compiled.clear();
            return compiled.computeIfAbsent(key, ignored -> registry.getSchema(schema));
        } catch (RuntimeException error) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    label + " is not a valid JSON Schema: " + error.getMessage(),
                    error);
        }
    }

    private void rejectRemoteReferences(JsonNode node, String label) {
        if (node == null) return;
        if (node.isObject()) {
            JsonNode reference = node.get("$ref");
            if (reference != null
                    && (!reference.isString() || !reference.asString().startsWith("#"))) {
                badRequest(label + " may use local $ref values only.");
            }
            node.values().forEach(value -> rejectRemoteReferences(value, label));
        } else if (node.isArray()) {
            node.values().forEach(value -> rejectRemoteReferences(value, label));
        }
    }

    private void badRequest(String message) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
