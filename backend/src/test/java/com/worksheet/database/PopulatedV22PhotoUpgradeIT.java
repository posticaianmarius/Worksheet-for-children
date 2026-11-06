package com.worksheet.database;

import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;

@Testcontainers(disabledWithoutDocker = true)
class PopulatedV22PhotoUpgradeIT {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    @Test
    void photoVersionsAreAddedWithoutRewritingDraftsRevisionsOrResults() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
            .target("22").load().migrate();
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var sql = connection.createStatement()) {
            sql.executeUpdate("""
                INSERT INTO auth_users (id, created_at, email, name, password_hash, role)
                  VALUES (100, CURRENT_TIMESTAMP, 'photo-upgrade@test.example', 'Teacher', 'hash', 'TEACHER');
                INSERT INTO mini_game_definition (id, name, type, version, configuration_schema, default_configuration, active)
                  VALUES (200, 'Sequence', 'sequence-game', 2,
                    '{"type":"object","properties":{"maxNumber":{"type":"integer","minimum":1},"exerciseCount":{"type":"integer","minimum":1,"maximum":100,"default":10}},"additionalProperties":false,"required":["maxNumber"]}'::jsonb,
                    '{"maxNumber":10,"exerciseCount":10}'::jsonb, TRUE);
                INSERT INTO worksheet (id, name, created_at, updated_at, user_id)
                  VALUES (300, 'Photos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 100);
                INSERT INTO worksheet_item (id, worksheet_id, mini_game_id, order_index, configuration)
                  VALUES (500, 300, 200, 0, '{"maxNumber":73,"exerciseCount":37}'::jsonb);
                INSERT INTO worksheet_revision (id, worksheet_id, revision_number, name_snapshot, content_hash, published_at)
                  VALUES (400, 300, 1, 'Photos', 'unchanged-hash', CURRENT_TIMESTAMP);
                INSERT INTO worksheet_revision_item
                  (id, worksheet_revision_id, source_worksheet_item_id, mini_game_definition_id, order_index, configuration)
                  VALUES (600, 400, 500, 200, 0, '{"maxNumber":73,"exerciseCount":37}'::jsonb);
                INSERT INTO worksheet_attempt
                  (id, worksheet_revision_id, status, total_score, max_score, started_at, completed_at)
                  VALUES (700, 400, 'COMPLETED', 29, 37, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
                INSERT INTO worksheet_attempt_item_result
                  (id, worksheet_attempt_id, worksheet_revision_item_id, outcome, score, max_score, time_seconds, details)
                  VALUES (800, 700, 600, 'COMPLETED', 29, 37, 123, '{"unchanged":true}'::jsonb);
                INSERT INTO mini_game_definition (id, name, type, version, configuration_schema, default_configuration, active, owner_user_id)
                  VALUES (900, 'Owned', 'owned-game', 1, '{}'::jsonb, '{}'::jsonb, TRUE, 100)
                """);
            var latest = Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()).target("24").load();
            assertEquals(2, latest.migrate().migrationsExecuted);
            assertEquals(0, latest.migrate().migrationsExecuted);
            latest.validate();
            var json = new ObjectMapper();
            try (var rows = sql.executeQuery("SELECT * FROM mini_game_definition WHERE type='sequence-game' AND version=3")) {
                assertTrue(rows.next());
                assertNotEquals(200, rows.getLong("id"));
                var schema = json.readTree(rows.getString("configuration_schema"));
                assertTrue(schema.at("/x-image-slots/activity-photo/allowUpload").asBoolean());
                assertFalse(schema.get("additionalProperties").asBoolean());
                assertEquals(100, schema.at("/properties/exerciseCount/maximum").asInt());
                assertTrue(json.readTree(rows.getString("default_configuration")).get("imageAssetId").isNull());
            }
            try (var rows = sql.executeQuery("""
                SELECT i.id, i.mini_game_id, i.configuration, r.id, r.mini_game_definition_id, r.configuration
                FROM worksheet_item i JOIN worksheet_revision_item r ON r.source_worksheet_item_id=i.id
                WHERE i.id=500
                """)) {
                assertTrue(rows.next());
                assertEquals(500, rows.getLong(1));
                assertEquals(200, rows.getLong(2));
                assertEquals(600, rows.getLong(4));
                assertEquals(200, rows.getLong(5));
                assertEquals(json.readTree("{\"maxNumber\":73,\"exerciseCount\":37}"), json.readTree(rows.getString(3)));
                assertEquals(json.readTree(rows.getString(3)), json.readTree(rows.getString(6)));
            }
            try (var rows = sql.executeQuery("SELECT configuration_schema FROM mini_game_definition WHERE id=900")) {
                assertTrue(rows.next()); assertEquals("{}", rows.getString(1));
            }
            try (var rows = sql.executeQuery("SELECT * FROM worksheet_attempt_item_result WHERE id=800")) {
                assertTrue(rows.next());
                assertEquals(29, rows.getInt("score"));
                assertEquals(37, rows.getInt("max_score"));
                assertEquals(123, rows.getInt("time_seconds"));
                assertTrue(json.readTree(rows.getString("details")).get("unchanged").asBoolean());
            }
        }
    }
}
