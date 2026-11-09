package com.worksheet.learning.api;

import com.worksheet.learning.access.StudentTestResponse;
import com.worksheet.learning.assignment.WorksheetAssignment;
import com.worksheet.learning.assignment.WorksheetAssignmentRepository;
import com.worksheet.learning.attempt.WorksheetAttemptRepository;
import com.worksheet.learning.attempt.WorksheetAttemptService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class LearningLifecycle {
    private final WorksheetAssignmentRepository assignments;
    private final WorksheetAttemptRepository attempts;
    private final WorksheetAttemptService lifecycle;
    private final LearningAccess access;

    public LearningLifecycle(
            WorksheetAssignmentRepository assignments,
            WorksheetAttemptRepository attempts,
            WorksheetAttemptService lifecycle,
            LearningAccess access) {
        this.assignments = assignments;
        this.attempts = attempts;
        this.lifecycle = lifecycle;
        this.access = access;
    }

    public void removeMember(Long classId, Long userId) {
        var work = assignments.findByClassroom_IdAndUser_IdAndRevokedAtIsNull(classId, userId);
        work.forEach(WorksheetAssignment::revoke);
        assignments.saveAll(work);
        lifecycle.abandonActiveForAssignments(work);
    }

    public void archiveClass(Long classId) {
        var work = assignments.findByClassroom_Id(classId);
        work.forEach(
                a -> {
                    access.register(a, null).close(Instant.now());
                    a.remove();
                });
        lifecycle.abandonActiveForAssignments(work);
    }

    public void archiveStudent(Long spaceId, Long userId) {
        var work = assignments.findBySpaceIdAndUser_IdOrderByAssignedAtDesc(spaceId, userId);
        work.forEach(WorksheetAssignment::revoke);
        lifecycle.abandonActiveForAssignments(work);
    }

    @Transactional(readOnly = true)
    public List<StudentTestResponse> studentHistory(Long classId, Long userId) {
        var work = assignments.findByClassroom_IdAndUser_IdOrderByAssignedAtDesc(classId, userId);
        var byId = work.stream().collect(Collectors.toMap(WorksheetAssignment::getId, a -> a));
        if (byId.isEmpty()) return List.of();
        return attempts
                .findByAssignment_IdInOrderByStartedAtDesc(List.copyOf(byId.keySet()))
                .stream()
                .map(
                        attempt -> {
                            var assignment = byId.get(attempt.getAssignment().getId());
                            return new StudentTestResponse(
                                    attempt.getId(),
                                    assignment.getId(),
                                    assignment.getWorksheetRevision().getNameSnapshot(),
                                    attempt.getStatus(),
                                    attempt.getTotalScore(),
                                    attempt.getMaxScore(),
                                    attempt.getStartedAt(),
                                    attempt.getCompletedAt());
                        })
                .sorted(Comparator.comparing(StudentTestResponse::startedAt).reversed())
                .toList();
    }
}
