package com.worksheet.database;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class MigrationDiscoveryTests {
    @Test
    void migrationsCanBeResolvedWithoutDuplicateVersions() {
        // Resolve real migration resources without executing PostgreSQL SQL or requiring Docker.
        var migrations =
                assertDoesNotThrow(
                        () ->
                                Flyway.configure()
                                        .dataSource("jdbc:h2:mem:migration_discovery", "sa", "")
                                        .locations("classpath:db/migration")
                                        .validateMigrationNaming(true)
                                        .load()
                                        .info()
                                        .all());

        assertTrue(
                migrations.length > 0, "Migration resources must be present on the test classpath");
    }
}
