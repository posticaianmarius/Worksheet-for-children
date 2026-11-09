package com.worksheet.application;

import com.worksheet.auth.User;
import com.worksheet.learning.access.StudentTestResponse;
import com.worksheet.learning.api.LearningLifecycle;
import com.worksheet.learning.assignment.CreateAssignmentRequest;
import com.worksheet.learning.assignment.WorksheetAssignmentService;
import com.worksheet.learning.sharing.WorksheetShareService;
import com.worksheet.teaching.classroom.ClassroomService;
import com.worksheet.teaching.space.SpaceAccess;
import com.worksheet.teaching.space.StudentDirectoryService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Cross-module state changes share one transaction; no asynchronous cleanup. */
@Service
@Transactional
public class TeachingWorkflows {
    private final ClassroomService classrooms;
    private final StudentDirectoryService directory;
    private final SpaceAccess spaces;
    private final LearningLifecycle learning;
    private final WorksheetShareService shares;
    private final WorksheetAssignmentService assignments;

    public TeachingWorkflows(
            ClassroomService classrooms,
            StudentDirectoryService directory,
            SpaceAccess spaces,
            LearningLifecycle learning,
            WorksheetShareService shares,
            WorksheetAssignmentService assignments) {
        this.classrooms = classrooms;
        this.directory = directory;
        this.spaces = spaces;
        this.learning = learning;
        this.shares = shares;
        this.assignments = assignments;
    }

    public void removeMember(Long classId, Long userId, User actor) {
        classrooms.removeMember(classId, userId, actor);
        learning.removeMember(classId, userId);
    }

    public void archive(Long classId, User actor) {
        var classroom = spaces.requireClass(classId, actor, false);
        if (classroom.getArchivedAt() != null) return;
        classrooms.archive(classId, actor);
        learning.archiveClass(classId);
    }

    public StudentDirectoryService.Student updateStudent(
            Long spaceId, Long id, String name, boolean archive, User actor) {
        spaces.owner(spaceId, actor);
        var existing = directory.get(spaceId, id);
        boolean newlyArchived = archive && existing.getArchivedAt() == null;
        var result = directory.update(spaceId, id, name, archive, actor);
        if (newlyArchived) learning.archiveStudent(spaceId, existing.getUserId());
        return result;
    }

    public List<StudentTestResponse> studentTests(Long classId, Long userId, User actor) {
        classrooms.requireHistoricalMember(classId, userId, actor);
        return learning.studentHistory(classId, userId);
    }

    public String startTest(Long classId, Long worksheetId, User actor) {
        classrooms.requireOwnedClassroom(classId, actor);
        String code = shares.shareCurrent(worksheetId, actor);
        assignments.create(worksheetId, actor, new CreateAssignmentRequest(classId, null));
        return code;
    }
}
