package com.worksheet.learning.api;

import com.worksheet.auth.*;
import com.worksheet.learning.assignment.WorksheetAssignment;
import com.worksheet.learning.delivery.*;
import com.worksheet.teaching.space.SpaceAccess;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class LearningAccess {
    private final SpaceAccess spaces;
    private final DeliveryRegistry deliveries;

    public LearningAccess(SpaceAccess spaces, DeliveryRegistry deliveries) {
        this.spaces = spaces;
        this.deliveries = deliveries;
    }

    public Long assignmentSpace(WorksheetAssignment assignment) {
        if (assignment.getSpaceId() == null) {
            assignment.setSpaceId(
                    assignment.getClassroom() == null
                            ? spaces.personal(assignment.getTeacher()).getId()
                            : spaces.classSpace(assignment.getClassroom()));
            spaces.ensureStudent(assignment.getSpaceId(), assignment.getUser());
        }
        return assignment.getSpaceId();
    }

    public boolean canRead(WorksheetAssignment assignment, User actor) {
        Long spaceId = assignmentSpace(assignment);
        if (!spaces.selected(spaceId, actor)) return false;
        if (actor.getRole() == UserRole.TEACHER) {
            return spaces.isOwner(spaceId, actor)
                    || (spaces.isTeacher(spaceId, actor)
                            && (assignment.getClassroom() != null
                                    ? spaces.canTeach(assignment.getClassroom(), actor)
                                    : assignment.getTeacher().getId().equals(actor.getId())));
        }
        return actor.getRole() == UserRole.USER
                && assignment.getUser().getId().equals(actor.getId())
                && spaces.isActiveStudent(spaceId, actor.getId());
    }

    public boolean canWrite(WorksheetAssignment assignment, User actor) {
        return actor.getRole() == UserRole.USER
                && assignment.getRevokedAt() == null
                && (assignment.getClassroom() == null
                        || assignment.getClassroom().getArchivedAt() == null)
                && canRead(assignment, actor);
    }

    public AssignmentDelivery register(WorksheetAssignment assignment, String title) {
        return deliveries.register(assignmentSpace(assignment), assignment, title);
    }
}
