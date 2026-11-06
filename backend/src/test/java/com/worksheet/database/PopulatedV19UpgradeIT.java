package com.worksheet.database;

import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers(disabledWithoutDocker = true)
class PopulatedV19UpgradeIT {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    @Test
    void existingSharesAndClassMembersSurviveUpgradeToLatest() throws Exception {
        Flyway.configure()
            .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
            .target("19")
            .load()
            .migrate();

        try (var connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var sql = connection.createStatement()) {
            sql.executeUpdate("""
                INSERT INTO auth_users (id, created_at, email, name, password_hash, role)
                VALUES (100, CURRENT_TIMESTAMP, 'teacher@v19.test', 'Teacher', 'hash', 'TEACHER')
                """);
            sql.executeUpdate("""
                INSERT INTO worksheet (id, name, created_at, updated_at, user_id, share_code)
                VALUES (300, 'Shared worksheet', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 100, 'SHARE019')
                """);
            sql.executeUpdate("""
                INSERT INTO worksheet_revision
                    (id, worksheet_id, revision_number, name_snapshot, content_hash, published_at)
                VALUES (400, 300, 1, 'Shared worksheet', 'existing-share-hash', CURRENT_TIMESTAMP)
                """);
            sql.executeUpdate("UPDATE worksheet SET share_revision_id = 400 WHERE id = 300");
            sql.executeUpdate("""
                INSERT INTO auth_users (id, created_at, email, name, password_hash, role)
                VALUES (101, CURRENT_TIMESTAMP, 'child@v19.test', 'Existing child', 'hash', 'USER')
                """);
            sql.executeUpdate("""
                INSERT INTO classroom (id, teacher_id, name, join_code, created_at)
                VALUES (200, 100, 'Existing class', 'CLASS019', CURRENT_TIMESTAMP)
                """);
            sql.executeUpdate("""
                INSERT INTO classroom_member (id, classroom_id, user_id, joined_at)
                VALUES (201, 200, 101, CURRENT_TIMESTAMP)
                """);

            Flyway latest = Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .load();
            assertEquals(6, latest.migrate().migrationsExecuted);
            latest.validate();
            assertEquals(0, latest.migrate().migrationsExecuted);

            try (var row = sql.executeQuery("SELECT share_code, share_revision_id FROM worksheet WHERE id = 300")) {
                assertTrue(row.next());
                assertEquals("SHARE019", row.getString("share_code"));
                assertEquals(400L, row.getLong("share_revision_id"));
            }
            try (var row = sql.executeQuery("SELECT user_id, student_code, left_at FROM classroom_member WHERE id = 201")) {
                assertTrue(row.next());
                assertEquals(101L, row.getLong("user_id"));
                org.junit.jupiter.api.Assertions.assertNull(row.getString("student_code"));
                org.junit.jupiter.api.Assertions.assertNull(row.getTimestamp("left_at"));
            }
            try (var row = sql.executeQuery("""
                    SELECT to_regclass('worksheet_item_image_asset') IS NOT NULL
                       AND to_regclass('worksheet_revision_item_image_asset') IS NOT NULL
                    """)) {
                assertTrue(row.next());
                assertTrue(row.getBoolean(1), "Both task-image reference tables must exist");
            }
        }
    }
}
