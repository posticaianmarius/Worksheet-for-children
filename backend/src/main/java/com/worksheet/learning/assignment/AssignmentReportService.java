package com.worksheet.learning.assignment;

import com.worksheet.auth.User;
import com.worksheet.learning.attempt.AttemptStatus;
import com.worksheet.learning.attempt.WorksheetAttempt;
import com.worksheet.learning.attempt.WorksheetAttemptRepository;
import com.worksheet.learning.legacy.result.WorksheetResult;
import com.worksheet.learning.legacy.result.WorksheetResultRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class AssignmentReportService {
    private final com.worksheet.learning.api.LearningAccess learning;
    private final com.worksheet.teaching.space.SpaceAccess spaces;
    private final WorksheetAssignmentRepository assignments;
    private final WorksheetAttemptRepository attempts;
    private final WorksheetResultRepository results;

    public AssignmentReportService(
            WorksheetAssignmentRepository assignments,
            WorksheetAttemptRepository attempts,
            WorksheetResultRepository results,
            com.worksheet.teaching.space.SpaceAccess spaces,
            com.worksheet.learning.api.LearningAccess learning) {
        this.learning = learning;
        this.spaces = spaces;
        this.assignments = assignments;
        this.attempts = attempts;
        this.results = results;
    }

    public List<AssignmentReportResponse> getReport(User teacher) {
        return getReport(teacher, false);
    }

    public List<AssignmentReportResponse> getReport(User teacher, boolean includeRemoved) {
        return getReport(teacher, includeRemoved, null);
    }

    public List<AssignmentReportResponse> getReport(
            User teacher, boolean includeRemoved, Long classroomId) {
        if (classroomId != null) spaces.requireClass(classroomId, teacher, false);
        var owned =
                assignments
                        .findVisible(
                                spaces.currentSpace(teacher),
                                teacher.getId(),
                                spaces.teacher(spaces.currentSpace(teacher), teacher).getOwner(),
                                classroomId)
                        .stream()
                        .filter(value -> learning.canRead(value, teacher))
                        .filter(
                                value ->
                                        includeRemoved
                                                || (value.getRemovedAt() == null
                                                        && (value.getClassroom() == null
                                                                || value.getClassroom()
                                                                                .getArchivedAt()
                                                                        == null)))
                        .toList();
        if (owned.isEmpty()) return List.of();
        var ids = owned.stream().map(WorksheetAssignment::getId).toList();
        Map<Long, List<WorksheetAttempt>> histories =
                attempts.findByAssignment_IdInOrderByStartedAtDesc(ids).stream()
                        .collect(Collectors.groupingBy(attempt -> attempt.getAssignment().getId()));
        Map<Long, List<WorksheetResult>> legacyResults =
                results.findByAssignment_IdInOrderByCompletedAtDesc(ids).stream()
                        .collect(Collectors.groupingBy(result -> result.getAssignment().getId()));
        return owned.stream()
                .map(
                        assignment ->
                                row(
                                        assignment,
                                        histories.getOrDefault(assignment.getId(), List.of()),
                                        legacyResults.getOrDefault(assignment.getId(), List.of())))
                .toList();
    }

    private AssignmentReportResponse row(
            WorksheetAssignment assignment,
            List<WorksheetAttempt> history,
            List<WorksheetResult> legacyResults) {
        var revision = assignment.getWorksheetRevision();
        var worksheet = revision.getWorksheet();
        var classroom = assignment.getClassroom();
        var completed =
                history.stream()
                        .filter(attempt -> attempt.getStatus() == AttemptStatus.COMPLETED)
                        .max(
                                java.util.Comparator.comparing(WorksheetAttempt::getCompletedAt)
                                        .thenComparing(WorksheetAttempt::getId))
                        .orElse(null);
        var legacy =
                legacyResults.stream()
                        .max(
                                java.util.Comparator.comparing(WorksheetResult::getCompletedAt)
                                        .thenComparing(WorksheetResult::getId))
                        .orElse(null);
        boolean useLegacy =
                legacy != null
                        && (completed == null
                                || legacy.getCompletedAt().isAfter(completed.getCompletedAt()));
        var completedAt =
                useLegacy
                        ? legacy.getCompletedAt()
                        : completed == null ? null : completed.getCompletedAt();
        Integer score =
                useLegacy
                        ? Integer.valueOf(legacy.getTotalScore())
                        : completed == null ? null : Integer.valueOf(completed.getTotalScore());
        Integer maxScore =
                useLegacy
                        ? Integer.valueOf(legacy.getMaxScore())
                        : completed == null ? null : Integer.valueOf(completed.getMaxScore());
        String status =
                assignment.getRevokedAt() != null
                        ? "REVOKED"
                        : completedAt != null
                                ? "COMPLETED"
                                : history.stream()
                                                .anyMatch(
                                                        attempt ->
                                                                attempt.getStatus()
                                                                        == AttemptStatus
                                                                                .IN_PROGRESS)
                                        ? "IN_PROGRESS"
                                        : history.isEmpty() ? "NOT_STARTED" : "ABANDONED";
        boolean codeMatches =
                assignment.getRemovedAt() == null
                        && (classroom == null || classroom.getArchivedAt() == null)
                        && worksheet.getShareCode() != null
                        && worksheet.getShareRevision() != null
                        && worksheet.getShareRevision().getId().equals(revision.getId());
        return new AssignmentReportResponse(
                assignment.getId(),
                classroom == null ? null : classroom.getId(),
                classroom == null ? null : classroom.getName(),
                worksheet.getId(),
                revision.getId(),
                revision.getRevisionNumber(),
                revision.getNameSnapshot(),
                codeMatches ? worksheet.getShareCode() : null,
                assignment.getRemovedAt() != null
                        ? "REMOVED"
                        : codeMatches
                                ? "ACTIVE"
                                : worksheet.getShareCode() == null
                                        ? "NOT_SHARED"
                                        : "VERSION_CHANGED",
                assignment.getUser().getId(),
                assignment.getUser().getName(),
                assignment.getAssignedAt(),
                assignment.getRevokedAt(),
                assignment.getRemovedAt(),
                status,
                useLegacy || completed == null ? null : completed.getId(),
                score,
                maxScore,
                completedAt,
                assignment.getBatchId(),
                learning.register(assignment, null).getTitle());
    }
}
