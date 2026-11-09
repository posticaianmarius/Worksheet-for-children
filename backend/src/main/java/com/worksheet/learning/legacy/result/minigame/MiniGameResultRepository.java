package com.worksheet.learning.legacy.result.minigame;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MiniGameResultRepository extends JpaRepository<MiniGameResult, Long> {
    List<MiniGameResult>
            findByWorksheetResult_IdAndWorksheetResult_Worksheet_User_IdOrderByWorksheetItem_OrderIndex(
                    Long worksheetResultId, Long userId);

    Optional<MiniGameResult> findByIdAndWorksheetResult_IdAndWorksheetResult_Worksheet_User_Id(
            Long id, Long worksheetResultId, Long userId);

    List<MiniGameResult> findByWorksheetResult_IdOrderByWorksheetItem_OrderIndex(
            Long worksheetResultId);

    Optional<MiniGameResult> findByIdAndWorksheetResult_Id(Long id, Long worksheetResultId);

    boolean existsByWorksheetItem_Id(Long worksheetItemId);

    @Modifying
    @Query("delete from MiniGameResult result where result.worksheetResult.id = :worksheetResultId")
    void deleteAllByWorksheetResultId(@Param("worksheetResultId") Long worksheetResultId);
}
