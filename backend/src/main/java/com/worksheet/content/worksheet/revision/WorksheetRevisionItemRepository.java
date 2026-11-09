package com.worksheet.content.worksheet.revision;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorksheetRevisionItemRepository
        extends JpaRepository<WorksheetRevisionItem, Long> {
    @EntityGraph(attributePaths = {"miniGameDefinition"})
    List<WorksheetRevisionItem> findByRevision_IdOrderByOrderIndex(Long revisionId);

    Optional<WorksheetRevisionItem> findByIdAndRevision_Id(Long id, Long revisionId);

    long countByRevision_Id(Long revisionId);

    boolean existsByMiniGameDefinition_Id(Long definitionId);

    boolean existsByImageAssets_Id(Long assetId);
}
