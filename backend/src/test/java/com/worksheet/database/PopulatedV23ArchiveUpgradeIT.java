package com.worksheet.database;

import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class PopulatedV23ArchiveUpgradeIT {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    @Test
    void archiveColumnsDoNotAlterExistingClassesAssignmentsRevisionsOrResults() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
            .target("23").load().migrate();
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             var sql = connection.createStatement()) {
            sql.executeUpdate("""
                INSERT INTO auth_users (id, created_at, email, name, password_hash, role) VALUES
                  (100, CURRENT_TIMESTAMP, 'archive-teacher@test.example', 'Teacher', 'hash', 'TEACHER'),
                  (101, CURRENT_TIMESTAMP, 'archive-child@test.example', 'Child', '!', 'USER');
                INSERT INTO classroom (id, teacher_id, name, join_code, created_at)
                  VALUES (200, 100, 'Existing class', 'CLAS2345', CURRENT_TIMESTAMP);
                INSERT INTO classroom_member (id, classroom_id, user_id, joined_at, student_code)
                  VALUES (201, 200, 101, CURRENT_TIMESTAMP, 'CHLD2345');
                INSERT INTO worksheet (id, name, created_at, updated_at, user_id)
                  VALUES (300, 'Existing draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 100);
                INSERT INTO worksheet_revision (id, worksheet_id, revision_number, name_snapshot, content_hash, published_at)
                  VALUES (400, 300, 1, 'Existing publication', 'unchanged', CURRENT_TIMESTAMP);
                INSERT INTO worksheet_assignment (id, batch_id, worksheet_revision_id, classroom_id, user_id, assigned_at)
                  VALUES (500, '00000000-0000-0000-0000-000000000001', 400, 200, 101, CURRENT_TIMESTAMP);
                INSERT INTO worksheet_attempt
                  (id, worksheet_revision_id, assignment_id, status, total_score, max_score, started_at, completed_at)
                  VALUES (600, 400, 500, 'COMPLETED', 7, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """);
            var latest = Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()).target("24").load();
            assertEquals(1, latest.migrate().migrationsExecuted);
            assertEquals(0, latest.migrate().migrationsExecuted);
            latest.validate();
            try (var rows = sql.executeQuery("""
                SELECT c.archived_at, a.removed_at, a.revoked_at, m.left_at, m.student_code,
                       r.name_snapshot, t.total_score, t.max_score, t.status
                FROM classroom c JOIN classroom_member m ON m.classroom_id=c.id
                JOIN worksheet_assignment a ON a.classroom_id=c.id
                JOIN worksheet_revision r ON r.id=a.worksheet_revision_id
                JOIN worksheet_attempt t ON t.assignment_id=a.id WHERE c.id=200
                """)) {
                assertTrue(rows.next());
                for (int column = 1; column <= 4; column++) assertNull(rows.getObject(column));
                assertEquals("CHLD2345", rows.getString(5));
                assertEquals("Existing publication", rows.getString(6));
                assertEquals(7, rows.getInt(7));
                assertEquals(10, rows.getInt(8));
                assertEquals("COMPLETED", rows.getString(9));
            }
        }
    }
}
