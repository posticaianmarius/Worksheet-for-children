package com.worksheet.database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

@Testcontainers
class PopulatedV13UpgradeIT {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @Test
    void populatedV13DataUpgradesWithoutLosingHistory() throws Exception {
        Flyway base =
                Flyway.configure()
                        .dataSource(
                                postgres.getJdbcUrl(),
                                postgres.getUsername(),
                                postgres.getPassword())
                        .cleanDisabled(false)
                        .target("13")
                        .load();
        base.clean();
        base.migrate();

        try (Connection connection = connection();
                Statement sql = connection.createStatement()) {
            sql.executeUpdate(
                    """
                    INSERT INTO auth_users (id, created_at, email, name, password_hash, role) VALUES
                      (100, CURRENT_TIMESTAMP, 'teacher@upgrade.test', 'Teacher', 'hash', 'TEACHER'),
                      (101, CURRENT_TIMESTAMP, 'user@upgrade.test', 'User', 'hash', 'USER')
                    """);
            sql.executeUpdate(
                    """
                    INSERT INTO mini_game_definition
                      (id, name, type, configuration_schema, active, version, result_schema,
                       default_configuration, owner_user_id, created_at, updated_at)
                    VALUES (200, 'Game', 'upgrade-game', '{}'::jsonb, TRUE, 1, '{}'::jsonb,
                            '{}'::jsonb, 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """);
            sql.executeUpdate(
                    """
                    INSERT INTO worksheet (id, name, created_at, updated_at, user_id)
                    VALUES (300, 'Historic worksheet', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 100)
                    """);
            sql.executeUpdate(
                    """
                    INSERT INTO worksheet_item (id, worksheet_id, mini_game_id, order_index, configuration)
                    VALUES (400, 300, 200, 0, '{"difficulty":2}'::jsonb)
                    """);
            sql.executeUpdate(
                    """
                    INSERT INTO classroom (id, teacher_id, name, join_code, created_at)
                    VALUES (600, 100, 'Historic class', 'UPGRADE1', CURRENT_TIMESTAMP)
                    """);
            sql.executeUpdate(
                    """
                    INSERT INTO classroom_member (id, classroom_id, user_id, joined_at)
                    VALUES (601, 600, 101, CURRENT_TIMESTAMP)
                    """);
            sql.executeUpdate(
                    """
                    INSERT INTO worksheet_assignment
                      (id, batch_id, worksheet_id, teacher_id, classroom_id, user_id, assigned_at)
                    VALUES (700, '00000000-0000-0000-0000-000000000700', 300, 100, 600, 101, CURRENT_TIMESTAMP)
                    """);
            sql.executeUpdate(
                    """
                    INSERT INTO worksheet_result
                      (id, worksheet_id, total_score, max_score, completed_at, assignment_id)
                    VALUES (500, 300, 3, 5, CURRENT_TIMESTAMP, 700)
                    """);
            sql.executeUpdate(
                    """
                    INSERT INTO mini_game_result
                      (id, worksheet_result_id, worksheet_item_id, score, max_score, time_seconds, details)
                    VALUES (800, 500, 400, 3, 5, 12, '{"moves":4}'::jsonb)
                    """);
            sql.executeUpdate(
                    """
                    INSERT INTO mini_game_asset
                      (id, owner_user_id, original_filename, storage_key, content_type, size_bytes, created_at)
                    VALUES (900, 100, 'historic.png', 'historic-key.png', 'image/png', 8, CURRENT_TIMESTAMP)
                    """);
        }

        Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .load()
                .migrate();

        try (Connection connection = connection();
                Statement sql = connection.createStatement()) {
            assertEquals(
                    1,
                    count(sql, "SELECT count(*) FROM worksheet_revision WHERE worksheet_id = 300"));
            assertEquals(
                    1,
                    count(
                            sql,
                            "SELECT count(*) FROM worksheet_revision_item WHERE"
                                + " source_worksheet_item_id = 400"));
            assertEquals(
                    1,
                    count(
                            sql,
                            "SELECT count(*) FROM worksheet_attempt WHERE id = 500 AND status ="
                                + " 'COMPLETED'"));
            assertEquals(
                    1,
                    count(
                            sql,
                            "SELECT count(*) FROM worksheet_attempt_item_result WHERE id = 800"));
            assertEquals(
                    1,
                    count(
                            sql,
                            "SELECT count(*) FROM worksheet_assignment WHERE id = 700 AND"
                                + " worksheet_revision_id IS NOT NULL"));
            try (ResultSet row =
                    sql.executeQuery("SELECT sha256 FROM mini_game_asset WHERE id = 900")) {
                row.next();
                assertNotNull(row.getString(1));
            }
            // V20 can link both historic draft items and backfilled revision items without changing
            // content.
            sql.executeUpdate("INSERT INTO worksheet_item_image_asset VALUES (400, 900)");
            sql.executeUpdate(
                    """
                    INSERT INTO worksheet_revision_item_image_asset (worksheet_revision_item_id, mini_game_asset_id)
                    SELECT id, 900 FROM worksheet_revision_item WHERE source_worksheet_item_id = 400
                    """);
            assertEquals(
                    1,
                    count(
                            sql,
                            "SELECT count(*) FROM worksheet_item_image_asset WHERE"
                                + " mini_game_asset_id = 900"));
            assertEquals(
                    1,
                    count(
                            sql,
                            "SELECT count(*) FROM worksheet_revision_item_image_asset WHERE"
                                + " mini_game_asset_id = 900"));
            assertThrows(
                    java.sql.SQLException.class,
                    () -> sql.executeUpdate("DELETE FROM mini_game_asset WHERE id = 900"));
            sql.executeUpdate(
                    """
                    INSERT INTO auth_users (created_at, email, name, password_hash, role)
                    VALUES (CURRENT_TIMESTAMP, 'admin@upgrade.test', 'Admin', 'hash', 'ADMIN')
                    """);
        }
    }

    private Connection connection() throws Exception {
        return DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private long count(Statement sql, String query) throws Exception {
        try (ResultSet row = sql.executeQuery(query)) {
            row.next();
            return row.getLong(1);
        }
    }
}
