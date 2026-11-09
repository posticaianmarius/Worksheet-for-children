package com.worksheet.database;

import com.worksheet.minigame.JsonSchemaValidationService;
import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class PopulatedV21UpgradeIT {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    @Test
    void exerciseCountCorrectionKeepsExistingDraftsAndPublishedConfigurations() throws Exception {
        Flyway.configure()
            .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
            .target("21").load().migrate();
        ObjectMapper json = new ObjectMapper();
        JsonSchemaValidationService validator = new JsonSchemaValidationService();
        String[] types = {"math-game", "sequence-game", "higher-lower-game", "odd-even-game"};
        try (var connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var sql = connection.createStatement()) {
            sql.executeUpdate("""
                INSERT INTO auth_users (id, created_at, email, name, password_hash, role)
                VALUES (100, CURRENT_TIMESTAMP, 'settings@v21.test', 'Teacher', 'hash', 'TEACHER');
                INSERT INTO worksheet (id, name, created_at, updated_at, user_id)
                VALUES (300, 'Existing worksheet', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 100);
                INSERT INTO worksheet_revision
                    (id, worksheet_id, revision_number, name_snapshot, content_hash, published_at)
                VALUES (400, 300, 1, 'Existing worksheet', 'unchanged-content', CURRENT_TIMESTAMP)
                """);
            int index = 0;
            for (String type : types) {
                for (int version : new int[] {1, 2}) {
                    int id = 200 + index;
                    String schema = version == 1
                        ? "{\"type\":\"object\",\"properties\":{},\"maxNumber\":{\"type\":\"integer\"}}"
                        : "{\"type\":\"object\",\"properties\":{\"maxNumber\":{\"type\":\"integer\",\"minimum\":1}},\"required\":[\"maxNumber\"],\"additionalProperties\":false}";
                    String defaults = "{\"maxNumber\":10}";
                    String configuration = version == 1
                        ? "{\"maxNumber\":73,\"exerciseCount\":37}" : "{\"maxNumber\":73}";
                    sql.executeUpdate("""
                        INSERT INTO mini_game_definition
                            (id, name, type, version, configuration_schema, default_configuration, active)
                        VALUES (%d, 'Built-in', '%s', %d, '%s'::jsonb, '%s'::jsonb, TRUE);
                        INSERT INTO worksheet_item (id, worksheet_id, mini_game_id, order_index, configuration)
                        VALUES (%d, 300, %d, %d, '%s'::jsonb);
                        INSERT INTO worksheet_revision_item
                            (id, worksheet_revision_id, source_worksheet_item_id, mini_game_definition_id, order_index, configuration)
                        VALUES (%d, 400, %d, %d, %d, '%s'::jsonb)
                        """.formatted(id, type, version, schema, defaults,
                            500 + index, id, index, configuration,
                            600 + index, 500 + index, id, index, configuration));
                    index++;
                }
            }
            sql.executeUpdate("""
                INSERT INTO mini_game_definition
                    (id, name, type, version, configuration_schema, default_configuration, owner_user_id, active)
                VALUES
                    (900, 'User-owned', 'MATH-GAME', 1, '{}'::jsonb, '{}'::jsonb, 100, TRUE),
                    (901, 'Later contract', 'math-game', 3, '{}'::jsonb, '{}'::jsonb, NULL, TRUE),
                    (902, 'Other game', 'color-game', 1, '{}'::jsonb, '{}'::jsonb, NULL, TRUE)
                """);
            // An already-declared built-in field/default must retain its original contract.
            sql.executeUpdate("""
                UPDATE mini_game_definition SET
                    configuration_schema = configuration_schema ||
                        '{"properties":{"exerciseCount":{"type":"integer","minimum":2}}}'::jsonb,
                    default_configuration = '{"maxNumber":10,"exerciseCount":20}'::jsonb
                WHERE id = 200
                """);
            Flyway latest = Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()).target("22").load();
            assertEquals(1, latest.migrate().migrationsExecuted);
            latest.validate();
            assertEquals(0, latest.migrate().migrationsExecuted);

            try (var rows = sql.executeQuery("SELECT * FROM mini_game_definition WHERE id BETWEEN 200 AND 207 ORDER BY id")) {
                int count = 0;
                while (rows.next()) {
                    int id = rows.getInt("id");
                    var schema = json.readTree(rows.getString("configuration_schema"));
                    var defaults = json.readTree(rows.getString("default_configuration"));
                    assertEquals(id == 200 ? 20 : 10, defaults.get("exerciseCount").asInt());
                    var edited = (ObjectNode) defaults.deepCopy();
                    edited.put("maxNumber", 73);
                    edited.put("exerciseCount", 43);
                    assertDoesNotThrow(() -> validator.validate(schema, edited, "Edited settings"));
                    if (id == 200) {
                        assertEquals(2, schema.at("/properties/exerciseCount/minimum").asInt());
                        assertTrue(schema.at("/properties/exerciseCount/maximum").isMissingNode());
                    } else {
                        assertEquals(100, schema.at("/properties/exerciseCount/maximum").asInt());
                        edited.put("exerciseCount", 101);
                        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                            () -> validator.validate(schema, edited, "Invalid settings"));
                    }
                    count++;
                }
                assertEquals(8, count);
            }
            try (var rows = sql.executeQuery("""
                    SELECT i.mini_game_id, i.configuration, r.mini_game_definition_id, r.configuration
                    FROM worksheet_item i JOIN worksheet_revision_item r ON r.source_worksheet_item_id = i.id
                    ORDER BY i.order_index
                    """)) {
                int count = 0;
                while (rows.next()) {
                    assertEquals(200 + count, rows.getInt(1));
                    assertEquals(200 + count, rows.getInt(3));
                    var expected = json.readTree(count % 2 == 0
                        ? "{\"maxNumber\":73,\"exerciseCount\":37}" : "{\"maxNumber\":73}");
                    assertEquals(expected, json.readTree(rows.getString(2)));
                    assertEquals(expected, json.readTree(rows.getString(4)));
                    count++;
                }
                assertEquals(8, count);
            }
            try (var rows = sql.executeQuery("SELECT * FROM mini_game_definition WHERE id BETWEEN 900 AND 902 ORDER BY id")) {
                while (rows.next()) {
                    var defaults = json.readTree(rows.getString("default_configuration"));
                    assertEquals(json.readTree("{}"), defaults);
                    assertEquals(json.readTree("{}"), json.readTree(rows.getString("configuration_schema")));
                }
            }
        }
    }
}
