package com.worksheet.assignment;

import com.worksheet.auth.User;
import com.worksheet.auth.UserRole;
import com.worksheet.attempt.AttemptStatus;
import com.worksheet.attempt.WorksheetAttemptRepository;
import com.worksheet.classroom.Classroom;
import com.worksheet.classroom.ClassroomMember;
import com.worksheet.classroom.ClassroomMemberRepository;
import com.worksheet.classroom.ClassroomRepository;
import com.worksheet.worksheet.Worksheet;
import com.worksheet.worksheet.WorksheetRepository;
import com.worksheet.worksheet.WorksheetResponse;
import com.worksheet.worksheet.revision.WorksheetRevision;
import com.worksheet.worksheet.revision.WorksheetRevisionResponseMapper;
import com.worksheet.worksheet.revision.WorksheetRevisionService;
import com.worksheet.worksheet.result.CreateWorksheetResultRequest;
import com.worksheet.worksheet.result.WorksheetResult;
import com.worksheet.worksheet.result.WorksheetResultRepository;
import com.worksheet.worksheet.result.WorksheetResultResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class WorksheetAssignmentService {
    private final com.worksheet.worksheet.revision.WorksheetRevisionRepository revisions;
    private final com.worksheet.space.SpaceAccess spaces;
    private final WorksheetAssignmentRepository assignments;
    private final WorksheetRepository worksheets;
    private final ClassroomRepository classrooms;
    private final ClassroomMemberRepository members;
    private final WorksheetResultRepository results;
    private final WorksheetRevisionService revisionService;
    private final WorksheetRevisionResponseMapper revisionResponses;
    private final WorksheetAttemptRepository attempts;

    public WorksheetAssignmentService(WorksheetAssignmentRepository assignments, WorksheetRepository worksheets,
            ClassroomRepository classrooms, ClassroomMemberRepository members, WorksheetResultRepository results,
            WorksheetRevisionService revisionService,
            WorksheetRevisionResponseMapper revisionResponses,
            WorksheetAttemptRepository attempts,com.worksheet.space.SpaceAccess spaces,com.worksheet.worksheet.revision.WorksheetRevisionRepository revisions) {
        this.revisions=revisions;
        this.spaces=spaces;
        this.assignments = assignments;
        this.worksheets = worksheets;
        this.classrooms = classrooms;
        this.members = members;
        this.results = results;
        this.revisionService = revisionService;
        this.revisionResponses = revisionResponses;
        this.attempts = attempts;
    }

    public record Preview(Long revisionId,WorksheetResponse worksheet) {}
    public Preview preview(Long worksheetId,User actor) {
        requireRole(actor,UserRole.TEACHER);
        var worksheet=worksheets.findByIdAndUser_Id(worksheetId,actor.getId()).orElseThrow(this::assignmentNotFound);
        var revision=revisionService.publish(worksheet);
        return new Preview(revision.getId(),revisionResponses.toResponse(revision));
    }

    @Transactional
    public List<WorksheetAssignmentResponse> create(Long worksheetId, User teacher, CreateAssignmentRequest request) {
        requireRole(teacher, UserRole.TEACHER);
        if((request.classroomId() == null) == (request.userId() == null)
                || (request.userIds() != null && request.classroomId() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Provide exactly one of classroomId or userId.");
        }
        if(request.title()!=null && request.title().strip().length()>150) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Delivery title must contain at most 150 characters.");
        Worksheet worksheet = worksheets.findByIdAndUser_Id(worksheetId, teacher.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Worksheet not found."));
        WorksheetRevision revision = request.revisionId()==null?revisionService.publish(worksheet):revisions.findById(request.revisionId()).filter(r -> r.getWorksheet().getId().equals(worksheetId)).orElseThrow(this::assignmentNotFound);
        UUID batchId = UUID.randomUUID();

        List<WorksheetAssignment> created;
        if(request.classroomId() != null) {
            Classroom classroom = spaces.requireClass(request.classroomId(),teacher,true);
            List<ClassroomMember> recipients = members.findByClassroom_IdAndLeftAtIsNullOrderByJoinedAt(classroom.getId()).stream().filter(m -> spaces.ensureStudent(classroom.getSpaceId(),m.getUser()).archivedAt==null).toList();
            if (request.userIds() != null) {
                var selected = new java.util.HashSet<>(request.userIds());
                if (selected.isEmpty() || selected.contains(null) || selected.size() != request.userIds().size()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select one or more distinct students.");
                }
                recipients = recipients.stream().filter(member -> selected.contains(member.getUser().getId())).toList();
                if (recipients.size() != selected.size()) {
                    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "A selected student is not an active member of this class.");
                }
            }
            if(recipients.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Class has no active users.");
            created = recipients.stream()
                .map(member -> new WorksheetAssignment(batchId, revision, classroom, member.getUser()))
                .toList();
        } else {
            ClassroomMember membership = members.findFirstByClassroom_Teacher_IdAndUser_IdAndLeftAtIsNullOrderByJoinedAt(teacher.getId(), request.userId())
                .filter(value -> value.getClassroom().getArchivedAt() == null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User is not an active member of this teacher's classes."));
            if(membership.getUser().getRole() != UserRole.USER) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only USER accounts can receive assignments.");
            }
            created = List.of(new WorksheetAssignment(batchId, revision, membership.getClassroom(), membership.getUser()));
        }
        for(var item:created) { item.setSpaceId(item.getClassroom()==null?spaces.currentSpace(teacher):spaces.classSpace(item.getClassroom())); spaces.ensureStudent(item.getSpaceId(),item.getUser()); }
        spaces.register(created.getFirst(),request.title());
        return assignments.saveAll(created).stream().map(this::toResponse).toList();
    }

    public List<WorksheetAssignmentResponse> getAll(User actor) {
        Long spaceId=spaces.currentSpace(actor);
        if(spaceId==null) return List.of();
        return (actor.getRole()==UserRole.TEACHER ? assignments.findVisible(spaceId,actor.getId(),spaces.teacher(spaceId,actor).owner,null) : assignments.findBySpaceIdAndUser_IdOrderByAssignedAtDesc(spaceId,actor.getId())).stream()
            .filter(a -> spaces.canRead(a,actor))
            .filter(a -> a.getRevokedAt()==null || results.existsByAssignment_Id(a.getId()) || attempts.existsByAssignment_IdAndStatus(a.getId(),AttemptStatus.COMPLETED))
            .map(this::toResponse).toList();
    }

    public void removeGroup(Long classroomId, Long revisionId, User teacher) {
        requireRole(teacher, UserRole.TEACHER);
        if (classroomId != null) spaces.requireClass(classroomId,teacher,true);
        var group = classroomId == null
            ? assignments.findByClassroomIsNullAndWorksheetRevision_Id(revisionId)
            : assignments.findByClassroom_IdAndWorksheetRevision_Id(classroomId, revisionId);
        var owned = group.stream().filter(value -> spaces.canRead(value,teacher)).toList();
        if (owned.isEmpty()) throw assignmentNotFound();
        owned.forEach(value -> { if(value.getClassroom()!=null) spaces.requireClass(value.getClassroom().getId(),teacher,true); spaces.register(value,null).closedAt=java.time.Instant.now(); value.remove(); });
        for (var assignment : owned) {
            attempts.findByAssignment_IdAndStatus(assignment.getId(), AttemptStatus.IN_PROGRESS)
                .forEach(com.worksheet.attempt.WorksheetAttempt::abandon);
        }
    }

    public void removeBatch(UUID batchId, User teacher) {
        requireRole(teacher, UserRole.TEACHER);
        var owned = assignments.findByBatchId(batchId).stream()
            .filter(value -> spaces.canRead(value,teacher)).toList();
        if (owned.isEmpty()) throw assignmentNotFound();
        owned.forEach(value -> { if(value.getClassroom()!=null) spaces.requireClass(value.getClassroom().getId(),teacher,true); spaces.register(value,null).closedAt=java.time.Instant.now(); value.remove(); });
        for (var assignment : owned) {
            attempts.findByAssignment_IdAndStatus(assignment.getId(), AttemptStatus.IN_PROGRESS)
                .forEach(com.worksheet.attempt.WorksheetAttempt::abandon);
        }
    }

    public List<WorksheetAssignmentResponse> delivery(UUID batchId,User actor) {
        var found=assignments.findByBatchId(batchId).stream().filter(a -> spaces.canRead(a,actor)).toList();
        if(found.isEmpty()) throw assignmentNotFound();
        return found.stream().map(this::toResponse).toList();
    }

    public WorksheetAssignmentResponse getById(Long assignmentId, User actor) {
        return toResponse(requireReadable(assignmentId, actor));
    }

    public WorksheetResultResponse createResult(Long assignmentId, User user, CreateWorksheetResultRequest request) {
        requireRole(user, UserRole.USER);
        WorksheetAssignment assignment = assignments.findById(assignmentId)
            .filter(value -> spaces.canWrite(value,user))
            .orElseThrow(() -> assignmentNotFound());
        validateScores(request);
        WorksheetResult result = results.save(new WorksheetResult(
            assignment.getWorksheetRevision().getWorksheet(), assignment, request.totalScore(), request.maxScore()));
        return toResultResponse(result);
    }

    public List<WorksheetResultResponse> getResults(Long assignmentId, User actor) {
        WorksheetAssignment assignment = requireReadable(assignmentId, actor);
        return results.findByAssignment_IdOrderByCompletedAtDesc(assignment.getId()).stream()
            .map(this::toResultResponse).toList();
    }

    private WorksheetAssignment requireReadable(Long assignmentId, User actor) {
        WorksheetAssignment assignment = assignments.findById(assignmentId).orElseThrow(() -> assignmentNotFound());
        if(!spaces.canRead(assignment,actor)) throw assignmentNotFound();
        return assignment;
    }

    private WorksheetAssignmentResponse toResponse(WorksheetAssignment assignment) {
        WorksheetResponse worksheetResponse = revisionResponses.toResponse(assignment.getWorksheetRevision());
        AssignmentStatus status = results.existsByAssignment_Id(assignment.getId())
                || attempts.existsByAssignment_IdAndStatus(assignment.getId(), AttemptStatus.COMPLETED)
                ? AssignmentStatus.COMPLETED
                : assignment.getRevokedAt()!=null ? AssignmentStatus.REVOKED : attempts.existsByAssignment_IdAndStatus(assignment.getId(), AttemptStatus.IN_PROGRESS)
                    ? AssignmentStatus.IN_PROGRESS : AssignmentStatus.NOT_STARTED;
        Long classroomId = assignment.getClassroom() == null ? null : assignment.getClassroom().getId();
        return new WorksheetAssignmentResponse(assignment.getId(), assignment.getBatchId(), worksheetResponse,
            assignment.getTeacher().getId(), assignment.getTeacher().getName(), classroomId,
            assignment.getUser().getId(), assignment.getUser().getName(), assignment.getAssignedAt(),
            assignment.getRevokedAt(), status,spaces.register(assignment,null).title,assignment.getClassroom()==null?null:assignment.getClassroom().getName());
    }

    private WorksheetResultResponse toResultResponse(WorksheetResult result) {
        return new WorksheetResultResponse(result.getId(), result.getWorksheet().getId(), result.getAssignment().getId(),
            result.getTotalScore(), result.getMaxScore(), result.getCompletedAt());
    }

    private void validateScores(CreateWorksheetResultRequest request) {
        if(request.totalScore() < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Total score cannot be negative.");
        if(request.maxScore() < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Max score cannot be negative.");
        if(request.totalScore() > request.maxScore()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Total score cannot exceed max score.");
    }

    private void requireRole(User user, UserRole role) {
        if(user.getRole() != role) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This account does not have permission for this action.");
    }

    private ResponseStatusException assignmentNotFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found.");
    }
}
