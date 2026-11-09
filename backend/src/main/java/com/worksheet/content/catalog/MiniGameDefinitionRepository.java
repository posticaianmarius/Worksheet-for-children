package com.worksheet.content.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MiniGameDefinitionRepository extends JpaRepository<MiniGameDefinition, Long> {
    boolean existsByTypeIgnoreCaseAndVersion(String type, int version);

    boolean existsByThumbnailAsset_Id(Long assetId);

    Optional<MiniGameDefinition> findByTypeIgnoreCaseAndVersion(String type, int version);

    Optional<MiniGameDefinition> findByIdAndOwner_Id(Long id, Long ownerId);

    List<MiniGameDefinition> findByActiveTrueOrderByTypeAscVersionDesc();
}
