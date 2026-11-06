package com.worksheet.assignment;

public record CreateAssignmentRequest(Long classroomId, Long userId, java.util.List<Long> userIds) {
    public CreateAssignmentRequest(Long classroomId, Long userId) {
        this(classroomId, userId, null);
    }
}
