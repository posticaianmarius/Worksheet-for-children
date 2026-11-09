package com.worksheet.database;

import static org.junit.jupiter.api.Assertions.*;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.DriverManager;

@Testcontainers
class PopulatedV24SpaceUpgradeIT {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    @Test
    void spaceMigrationKeepsIdentitiesSnapshotsScoresAndValidCredentialAliases() throws Exception {
        Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .target("24")
                .load()
                .migrate();
        try (var connection =
                        DriverManager.getConnection(
                                postgres.getJdbcUrl(),
                                postgres.getUsername(),
                                postgres.getPassword());
                var sql = connection.createStatement()) {
            sql.executeUpdate(
                    """
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
            sql.executeUpdate(
                    """
                    INSERT INTO auth_users(id,created_at,email,name,password_hash,role) VALUES
                      (102,CURRENT_TIMESTAMP,'other-teacher@test.example','Other teacher','hash','TEACHER'),
                      (103,CURRENT_TIMESTAMP,'same-name@test.example','Child','!','USER');
                    INSERT INTO classroom(id,teacher_id,name,join_code,created_at) VALUES
                      (202,100,'Second class','CLAS6789',CURRENT_TIMESTAMP),
                      (203,102,'Other space','OTHR6789',CURRENT_TIMESTAMP),
                      (204,100,'Archived','ARCH6789',CURRENT_TIMESTAMP);
                    UPDATE classroom SET archived_at=CURRENT_TIMESTAMP WHERE id=204;
                    INSERT INTO classroom_member(id,classroom_id,user_id,joined_at,student_code,left_at) VALUES
                      (205,202,101,CURRENT_TIMESTAMP + interval '1 minute','CHLD6789',NULL),
                      (206,203,101,CURRENT_TIMESTAMP,'OTHR2345',NULL),
                      (207,204,101,CURRENT_TIMESTAMP,'ARCH2345',NULL),
                      (208,202,103,CURRENT_TIMESTAMP,'LEFT2345',CURRENT_TIMESTAMP);
                    """);
            var latest =
                    Flyway.configure()
                            .dataSource(
                                    postgres.getJdbcUrl(),
                                    postgres.getUsername(),
                                    postgres.getPassword())
                            .load();
            assertEquals(1, latest.migrate().migrationsExecuted);
            assertEquals(0, latest.migrate().migrationsExecuted);
            latest.validate();
            try (var rows =
                    sql.executeQuery(
                            """
                            SELECT c.archived_at, a.removed_at, a.revoked_at, m.left_at, m.student_code,
                                   r.name_snapshot, t.total_score, t.max_score, t.status
                            FROM classroom c JOIN classroom_member m ON m.classroom_id=c.id
                            JOIN worksheet_assignment a ON a.classroom_id=c.id
                            JOIN worksheet_revision r ON r.id=a.worksheet_revision_id
                            JOIN worksheet_attempt t ON t.assignment_id=a.id WHERE c.id=200
                            """)) {
                assertTrue(rows.next());
                for (int column = 1; column <= 4; column++) assertNull(rows.getObject(column));
                assertNull(rows.getString(5));
                assertEquals("Existing publication", rows.getString(6));
                assertEquals(7, rows.getInt(7));
                assertEquals(10, rows.getInt(8));
                assertEquals("COMPLETED", rows.getString(9));
            }
            try (var rows =
                    sql.executeQuery(
                            """
                            SELECT (SELECT COUNT(*) FROM teaching_space),
                                   (SELECT COUNT(*) FROM space_student WHERE user_id=101),
                                   (SELECT COUNT(*) FROM student_credential),
                                   (SELECT code FROM student_credential WHERE primary_code AND student_id=(SELECT student_id FROM classroom_member WHERE id=201)),
                                   (SELECT COUNT(*) FROM space_student WHERE name='Child' AND space_id=(SELECT space_id FROM classroom WHERE id=200)),
                                   (SELECT batch_id::text FROM assignment_delivery)
                            """)) {
                assertTrue(rows.next());
                assertEquals(2, rows.getInt(1));
                assertEquals(2, rows.getInt(2));
                assertEquals(3, rows.getInt(3));
                assertEquals("CHLD2345", rows.getString(4));
                assertEquals(2, rows.getInt(5));
                assertEquals("00000000-0000-0000-0000-000000000001", rows.getString(6));
            }
        }
    }
}
