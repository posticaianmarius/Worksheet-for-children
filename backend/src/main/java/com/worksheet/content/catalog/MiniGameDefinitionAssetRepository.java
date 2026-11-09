package com.worksheet.content.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MiniGameDefinitionAssetRepository
        extends JpaRepository<MiniGameDefinitionAsset, Long> {
    List<MiniGameDefinitionAsset> findByDefinition_IdOrderByAssetKey(Long definitionId);

    boolean existsByAsset_Id(Long assetId);

    void deleteByDefinition_Id(Long definitionId);
}
