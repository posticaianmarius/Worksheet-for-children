package com.worksheet.content.catalog.asset;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface MiniGameAssetRepository extends JpaRepository<MiniGameAsset, Long> {
    Optional<MiniGameAsset> findByIdAndOwner_Id(Long id, Long ownerId);

    Optional<MiniGameAsset> findByIdAndStatus(Long id, MiniGameAssetStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from MiniGameAsset a where a.id = :id and a.status = :status")
    Optional<MiniGameAsset> lockByIdAndStatus(Long id, MiniGameAssetStatus status);

    Page<MiniGameAsset> findByOwner_IdAndStatusAndContentTypeStartingWith(
            Long ownerId, MiniGameAssetStatus status, String contentType, Pageable pageable);
}
