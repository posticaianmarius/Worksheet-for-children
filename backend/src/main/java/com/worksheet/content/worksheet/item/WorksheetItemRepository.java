package com.worksheet.content.worksheet.item;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorksheetItemRepository extends JpaRepository<WorksheetItem, Long> {
    boolean existsByMiniGame_Id(Long miniGameId);

    boolean existsByImageAssets_Id(Long assetId);

    List<WorksheetItem> findByWorksheet_IdAndWorksheet_User_IdOrderByOrderIndex(
            Long worksheetId, Long userId);

    Optional<WorksheetItem> findByIdAndWorksheet_IdAndWorksheet_User_Id(
            Long id, Long worksheetId, Long userId);

    Optional<WorksheetItem> findByIdAndWorksheet_Id(Long id, Long worksheetId);

    List<WorksheetItem> findByWorksheet_IdOrderByOrderIndex(Long worksheetId);
}
