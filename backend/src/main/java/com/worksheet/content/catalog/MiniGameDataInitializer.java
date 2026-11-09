package com.worksheet.content.catalog;

import com.worksheet.minigame.BuiltinPhotoConfiguration;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

@Component
public class MiniGameDataInitializer implements CommandLineRunner {
    private static final int INITIAL_VERSION = 1;
    private static final int CORRECTED_SCHEMA_VERSION = 2;
    private static final int DEFAULT_EXERCISE_COUNT = 10;
    private static final int MAX_EXERCISE_COUNT = 100;

    private final MiniGameDefinitionRepository repository;
    private final JsonSchemaValidationService schemaValidator;

    public MiniGameDataInitializer(
            MiniGameDefinitionRepository repository, JsonSchemaValidationService schemaValidator) {
        this.repository = repository;
        this.schemaValidator = schemaValidator;
    }

    @Override
    public void run(String... args) {
        createIfMissing(
                "Color Game",
                "color-game",
                colorConfigurationSchema(),
                colorDefaultConfiguration());

        createIfMissing(
                "Easy Math", "math-game", mathConfigurationSchema(), mathDefaultConfiguration());

        createIfMissing(
                "Number Sequence",
                "sequence-game",
                sequenceConfigurationSchema(),
                sequenceDefaultConfiguration());

        createIfMissing(
                "Higher or Lower",
                "higher-lower-game",
                higherLowerConfigurationSchema(),
                higherLowerDefaultConfiguration());

        createIfMissing(
                "Odd or Even",
                "odd-even-game",
                oddEvenConfigurationSchema(),
                oddEvenDefaultConfiguration());

        createIfMissing(
                "Match the Amounts",
                "matching-game",
                matchingConfigurationSchema(),
                matchingDefaultConfiguration());
    }

    private void createIfMissing(
            String name, String type, JsonNode configurationSchema, JsonNode defaultConfiguration) {
        createLegacyIfMissing(name, type, configurationSchema, defaultConfiguration);
        if (repository.existsByTypeIgnoreCaseAndVersion(type, BuiltinPhotoConfiguration.VERSION))
            return;
        var schema = BuiltinPhotoConfiguration.schema(type, configurationSchema);
        var defaults = BuiltinPhotoConfiguration.defaults(defaultConfiguration);
        schemaValidator.validateSchema(schema, name + " photo schema");
        schemaValidator.validate(schema, defaults, name + " photo defaults");
        repository.save(
                new MiniGameDefinition(
                        name,
                        type,
                        BuiltinPhotoConfiguration.VERSION,
                        schema,
                        emptyObject(),
                        defaults,
                        null,
                        true));
    }

    private void createLegacyIfMissing(
            String name, String type, JsonNode configurationSchema, JsonNode defaultConfiguration) {
        if (repository.existsByTypeIgnoreCaseAndVersion(type, CORRECTED_SCHEMA_VERSION)) {
            return;
        }

        var initial = repository.findByTypeIgnoreCaseAndVersion(type, INITIAL_VERSION);
        if (initial.isPresent()
                && initial.get().getConfigurationSchema().equals(configurationSchema)
                && initial.get().getDefaultConfiguration().equals(defaultConfiguration)) {
            return;
        }
        int version = initial.isPresent() ? CORRECTED_SCHEMA_VERSION : INITIAL_VERSION;

        schemaValidator.validateSchema(configurationSchema, name + " configuration schema");
        schemaValidator.validate(
                configurationSchema, defaultConfiguration, name + " default configuration");

        repository.save(
                new MiniGameDefinition(
                        name,
                        type,
                        version,
                        configurationSchema,
                        emptyObject(),
                        defaultConfiguration,
                        null,
                        true));
    }

    private JsonNode matchingConfigurationSchema() {
        ObjectNode schema = baseObjectSchema();

        ObjectNode pair = baseObjectSchema();
        addStringProperty(pair, "id");
        addStringProperty(pair, "emoji");
        ObjectNode number = JsonNodeFactory.instance.objectNode();
        number.put("type", "integer");
        number.put("minimum", 1);
        number.put("maximum", 50);
        properties(pair).set("number", number);
        require(pair, "id", "number", "emoji");

        ObjectNode pairs = JsonNodeFactory.instance.objectNode();
        pairs.put("type", "array");
        pairs.put("minItems", 1);
        pairs.put("maxItems", 6);
        pairs.set("items", pair);

        properties(schema).set("pairs", pairs);
        require(schema, "pairs");
        return schema;
    }

    private JsonNode matchingDefaultConfiguration() {
        ObjectNode config = JsonNodeFactory.instance.objectNode();
        var pairs = JsonNodeFactory.instance.arrayNode();
        pairs.add(matchingPair("one", 1, "🍎"));
        pairs.add(matchingPair("two", 2, "🍊"));
        pairs.add(matchingPair("three", 3, "🍌"));
        config.set("pairs", pairs);
        return config;
    }

    private ObjectNode matchingPair(String id, int number, String emoji) {
        ObjectNode pair = JsonNodeFactory.instance.objectNode();
        pair.put("id", id);
        pair.put("number", number);
        pair.put("emoji", emoji);
        return pair;
    }

    private JsonNode colorConfigurationSchema() {
        ObjectNode schema = baseObjectSchema();

        ObjectNode animal = baseObjectSchema();
        addStringProperty(animal, "id");
        addStringProperty(animal, "name");
        addStringProperty(animal, "img");
        require(animal, "id", "name", "img");

        ObjectNode animals = JsonNodeFactory.instance.objectNode();
        animals.put("type", "array");
        animals.set("items", animal);
        animals.put("minItems", 1);

        properties(schema).set("animals", animals);

        ObjectNode letter = JsonNodeFactory.instance.objectNode();
        letter.put("type", "string");

        letter.put("minLength", 1);
        properties(schema).set("letter", letter);
        require(schema, "animals", "letter");

        return schema;
    }

    private JsonNode colorDefaultConfiguration() {
        ObjectNode config = JsonNodeFactory.instance.objectNode();

        config.put("letter", "u");
        var animals = JsonNodeFactory.instance.arrayNode();
        animals.add(animal("bear", "Urs", "/img/BearImg.webp"));
        animals.add(animal("fox", "Vulpe", "/img/FoxImg.webp"));
        animals.add(animal("wolf", "Lup", "/img/WolfImg.webp"));
        config.set("animals", animals);

        return config;
    }

    private ObjectNode animal(String id, String name, String image) {
        ObjectNode animal = JsonNodeFactory.instance.objectNode();
        animal.put("id", id);
        animal.put("name", name);
        animal.put("img", image);
        return animal;
    }

    private JsonNode mathConfigurationSchema() {
        ObjectNode schema = numberConfigurationSchema();

        ObjectNode operations = JsonNodeFactory.instance.objectNode();
        operations.put("type", "array");
        operations.put("minItems", 1);
        operations.put("uniqueItems", true);
        ObjectNode operation = JsonNodeFactory.instance.objectNode();
        operation.put("type", "string");
        var allowedOperations = JsonNodeFactory.instance.arrayNode();
        allowedOperations.add("+");
        allowedOperations.add("-");
        allowedOperations.add("*");
        allowedOperations.add("/");
        operation.set("enum", allowedOperations);
        operations.set("items", operation);

        properties(schema).set("operations", operations);
        require(schema, "maxNumber", "operations");

        return schema;
    }

    private JsonNode mathDefaultConfiguration() {
        ObjectNode config = numberDefaultConfiguration();

        var operations = JsonNodeFactory.instance.arrayNode();
        operations.add("+");
        operations.add("-");
        operations.add("*");
        operations.add("/");

        config.set("operations", operations);

        return config;
    }

    private JsonNode sequenceConfigurationSchema() {
        return numberConfigurationSchema();
    }

    private JsonNode sequenceDefaultConfiguration() {
        return numberDefaultConfiguration();
    }

    private JsonNode higherLowerConfigurationSchema() {
        return numberConfigurationSchema();
    }

    private JsonNode higherLowerDefaultConfiguration() {
        return numberDefaultConfiguration();
    }

    private JsonNode oddEvenConfigurationSchema() {
        return numberConfigurationSchema();
    }

    private JsonNode oddEvenDefaultConfiguration() {
        return numberDefaultConfiguration();
    }

    // Shared contract for every built-in number game. Keep editor bounds and defaults in sync.
    private ObjectNode numberConfigurationSchema() {
        ObjectNode schema = baseObjectSchema();

        ObjectNode maxNumber = JsonNodeFactory.instance.objectNode();
        maxNumber.put("type", "integer");
        maxNumber.put("minimum", 1);

        properties(schema).set("maxNumber", maxNumber);
        ObjectNode exerciseCount = JsonNodeFactory.instance.objectNode();
        exerciseCount.put("type", "integer");
        exerciseCount.put("minimum", 1);
        exerciseCount.put("maximum", MAX_EXERCISE_COUNT);
        exerciseCount.put("default", DEFAULT_EXERCISE_COUNT);
        properties(schema).set("exerciseCount", exerciseCount);
        // Optional so saved worksheets that predate the field remain valid.
        require(schema, "maxNumber");

        return schema;
    }

    private ObjectNode numberDefaultConfiguration() {
        ObjectNode config = JsonNodeFactory.instance.objectNode();

        config.put("maxNumber", 10);
        config.put("exerciseCount", DEFAULT_EXERCISE_COUNT);

        return config;
    }

    private ObjectNode baseObjectSchema() {
        ObjectNode schema = JsonNodeFactory.instance.objectNode();

        schema.put("type", "object");
        schema.set("properties", JsonNodeFactory.instance.objectNode());
        schema.put("additionalProperties", false);

        return schema;
    }

    private ObjectNode properties(ObjectNode schema) {
        return (ObjectNode) schema.get("properties");
    }

    private void addStringProperty(ObjectNode schema, String name) {
        ObjectNode property = JsonNodeFactory.instance.objectNode();
        property.put("type", "string");
        properties(schema).set(name, property);
    }

    private void require(ObjectNode schema, String... names) {
        var required = JsonNodeFactory.instance.arrayNode();
        for (String name : names) required.add(name);
        schema.set("required", required);
    }

    private ObjectNode emptyObject() {
        return JsonNodeFactory.instance.objectNode();
    }
}
