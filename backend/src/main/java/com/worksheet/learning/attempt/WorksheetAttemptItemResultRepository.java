package com.worksheet.learning.attempt;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorksheetAttemptItemResultRepository
        extends JpaRepository<WorksheetAttemptItemResult, Long> {
    @EntityGraph(attributePaths = {"revisionItem"})
    List<WorksheetAttemptItemResult> findByAttempt_IdOrderByRevisionItem_OrderIndex(Long attemptId);

    Optional<WorksheetAttemptItemResult> findByAttempt_IdAndRevisionItem_Id(
            Long attemptId, Long revisionItemId);

    long countByAttempt_Id(Long attemptId);
}
