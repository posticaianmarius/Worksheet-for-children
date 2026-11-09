package com.worksheet.content.worksheet.revision;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WorksheetRevisionRepository extends JpaRepository<WorksheetRevision, Long> {
    boolean existsByWorksheet_Id(Long worksheetId);

    Optional<WorksheetRevision> findByWorksheet_IdAndContentHash(
            Long worksheetId, String contentHash);

    Optional<WorksheetRevision> findFirstByWorksheet_IdOrderByRevisionNumberDesc(Long worksheetId);
}
