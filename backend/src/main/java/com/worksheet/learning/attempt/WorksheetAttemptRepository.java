package com.worksheet.learning.attempt;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorksheetAttemptRepository extends JpaRepository<WorksheetAttempt, Long> {
    @EntityGraph(attributePaths = {"assignment"})
    List<WorksheetAttempt> findByAssignment_IdInOrderByStartedAtDesc(List<Long> assignmentIds);

    @EntityGraph(
            attributePaths = {
                "revision",
                "revision.worksheet",
                "revision.worksheet.user",
                "assignment",
                "assignment.user"
            })
    List<WorksheetAttempt> findByAssignment_IdOrderByStartedAtDesc(Long assignmentId);

    List<WorksheetAttempt> findByAssignment_IdAndStatus(Long assignmentId, AttemptStatus status);

    boolean existsByAssignment_IdAndStatus(Long assignmentId, AttemptStatus status);

    @EntityGraph(
            attributePaths = {
                "revision",
                "revision.worksheet",
                "revision.worksheet.user",
                "assignment",
                "assignment.user"
            })
    List<WorksheetAttempt> findByRevision_Worksheet_IdAndAssignmentIsNullOrderByStartedAtDesc(
            Long worksheetId);

    @Override
    @EntityGraph(
            attributePaths = {
                "revision",
                "revision.worksheet",
                "revision.worksheet.user",
                "assignment",
                "assignment.user"
            })
    Optional<WorksheetAttempt> findById(Long id);
}
