package com.worksheet.learning.sharing;

import com.worksheet.auth.User;
import com.worksheet.auth.UserRole;
import com.worksheet.content.worksheet.*;
import com.worksheet.learning.assignment.WorksheetAssignment;
import com.worksheet.learning.assignment.WorksheetAssignmentRepository;
import com.worksheet.teaching.classroom.ClassroomMember;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class WorksheetShareService {
    private final com.worksheet.teaching.api.ClassRosters rosters;
    private final com.worksheet.content.api.WorksheetContent content;
    private final com.worksheet.learning.api.LearningAccess learning;
    private final com.worksheet.teaching.space.SpaceAccess spaces;
    private final WorksheetAssignmentRepository assignments;

    public WorksheetShareService(
            WorksheetAssignmentRepository assignments,
            com.worksheet.teaching.space.SpaceAccess spaces,
            com.worksheet.learning.api.LearningAccess learning,
            com.worksheet.content.api.WorksheetContent content,
            com.worksheet.teaching.api.ClassRosters rosters) {
        this.rosters = rosters;
        this.content = content;
        this.learning = learning;
        this.spaces = spaces;
        this.assignments = assignments;
    }

    public String share(Long id, User teacher) {
        return content.share(
                id, teacher, com.worksheet.content.api.WorksheetContent.ShareMode.EXISTING);
    }

    public String rotate(Long id, User teacher) {
        return content.share(
                id, teacher, com.worksheet.content.api.WorksheetContent.ShareMode.REPLACE);
    }

    public String shareCurrent(Long id, User teacher) {
        return content.share(
                id, teacher, com.worksheet.content.api.WorksheetContent.ShareMode.CURRENT);
    }

    public JoinWorksheetResponse join(String rawCode, User user) {
        requireRole(user, UserRole.USER);
        return join(rawCode, user, null);
    }

    public JoinWorksheetResponse joinForStudent(String rawCode, ClassroomMember member) {
        requireRole(member.getUser(), UserRole.USER);
        return join(rawCode, member.getUser(), member);
    }

    private JoinWorksheetResponse join(String rawCode, User user, ClassroomMember member) {
        return joinInSpace(
                rawCode,
                user,
                member == null
                        ? spaces.currentSpace(user)
                        : spaces.classSpace(member.getClassroom()));
    }

    public record Choice(
            Long assignmentId,
            UUID batchId,
            String classroomName,
            String title,
            String worksheetName,
            java.time.Instant assignedAt) {}

    public java.util.List<Choice> choices(String rawCode, User user) {
        Long spaceId = spaces.currentSpace(user);
        var worksheet = content.byShareCode(normalize(rawCode)).orElseThrow(this::codeNotFound);
        if (worksheet.getShareRevision() == null) return java.util.List.of();
        return assignments
                .findBySpaceIdAndUser_IdOrderByAssignedAtDesc(spaceId, user.getId())
                .stream()
                .filter(
                        a ->
                                a.getWorksheetRevision()
                                                .getId()
                                                .equals(worksheet.getShareRevision().getId())
                                        && learning.canWrite(a, user))
                .map(
                        a ->
                                new Choice(
                                        a.getId(),
                                        a.getBatchId(),
                                        a.getClassroom() == null
                                                ? null
                                                : a.getClassroom().getName(),
                                        learning.register(a, null).getTitle(),
                                        pinnedName(a),
                                        a.getAssignedAt()))
                .toList();
    }

    private String pinnedName(WorksheetAssignment assignment) {
        return assignment.getWorksheetRevision().getNameSnapshot();
    }

    public JoinWorksheetResponse joinInSpace(String rawCode, User user, Long spaceId) {
        var worksheet = content.byShareCode(normalize(rawCode)).orElseThrow(this::codeNotFound);
        var revision = worksheet.getShareRevision();
        if (revision == null) revision = content.ensureSharedRevision(worksheet);
        final var pinned = revision;
        var candidates =
                spaceId == null
                        ? java.util.List.<WorksheetAssignment>of()
                        : assignments
                                .findBySpaceIdAndUser_IdOrderByAssignedAtDesc(spaceId, user.getId())
                                .stream()
                                .filter(
                                        a ->
                                                a.getWorksheetRevision()
                                                                .getId()
                                                                .equals(pinned.getId())
                                                        && a.getRevokedAt() == null
                                                        && (a.getClassroom() == null
                                                                || a.getClassroom().getArchivedAt()
                                                                        == null))
                                .toList();
        if (candidates.size() > 1)
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Choose the class and assignment you want to open.");
        if (candidates.size() == 1)
            return JoinWorksheetResponse.from(
                    content.snapshot(pinned), candidates.getFirst().getId());
        // Historic general share codes can create direct work only inside the author's personal
        // space.
        Long sourceSpace = spaces.personal(worksheet.getUser()).getId();
        if (spaceId != null && !spaceId.equals(sourceSpace)) throw codeNotFound();
        var profile = spaces.ensureStudent(sourceSpace, user);
        if (profile.getArchivedAt() != null
                || assignments.existsByWorksheetRevision_IdAndUser_IdAndRemovedAtIsNotNull(
                        pinned.getId(), user.getId())) throw codeNotFound();
        if ("!".equals(user.getPasswordHash())) {
            boolean eligible =
                    rosters.memberships(user.getId()).stream()
                            .anyMatch(
                                    m ->
                                            sourceSpace.equals(spaces.classSpace(m.getClassroom()))
                                                    && m.getClassroom().getArchivedAt() == null);
            if (!eligible) throw codeNotFound();
            var classIds =
                    rosters.memberships(user.getId()).stream()
                            .map(m -> m.getClassroom().getId())
                            .collect(java.util.stream.Collectors.toSet());
            if (assignments.findBySpaceIdOrderByAssignedAtDesc(sourceSpace).stream()
                    .anyMatch(
                            a ->
                                    a.getWorksheetRevision().getId().equals(pinned.getId())
                                            && a.getClassroom() != null
                                            && classIds.contains(a.getClassroom().getId())))
                throw codeNotFound();
        }
        var assignment = new WorksheetAssignment(UUID.randomUUID(), pinned, null, user);
        assignment.setSpaceId(sourceSpace);
        learning.register(assignment, null);
        assignments.save(assignment);
        return JoinWorksheetResponse.from(content.snapshot(pinned), assignment.getId());
    }

    private String normalize(String code) {
        if (code == null || code.isBlank()) throw codeNotFound();
        return code.strip().toUpperCase(Locale.ROOT);
    }

    private void requireRole(User user, UserRole role) {
        if (user.getRole() != role) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "This account does not have permission for this action.");
        }
    }

    private ResponseStatusException codeNotFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Worksheet code not found.");
    }
}
