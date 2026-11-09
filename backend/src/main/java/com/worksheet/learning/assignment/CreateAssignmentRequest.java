package com.worksheet.learning.assignment;

public record CreateAssignmentRequest(
        Long classroomId,
        Long userId,
        java.util.List<Long> userIds,
        String title,
        Long revisionId) {
    public CreateAssignmentRequest(Long classroomId, Long userId, java.util.List<Long> userIds) {
        this(classroomId, userId, userIds, null, null);
    }

    public CreateAssignmentRequest(Long classroomId, Long userId) {
        this(classroomId, userId, null, null, null);
    }
}
