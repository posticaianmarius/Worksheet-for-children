package com.worksheet.classroom;

import com.worksheet.assignment.WorksheetAssignment;
import com.worksheet.assignment.WorksheetAssignmentRepository;
import com.worksheet.assignment.WorksheetAssignmentService;
import com.worksheet.assignment.CreateAssignmentRequest;
import com.worksheet.worksheet.WorksheetShareService;
import com.worksheet.attempt.WorksheetAttemptService;
import com.worksheet.auth.User;
import com.worksheet.auth.UserRole;
import com.worksheet.auth.UserRepository;
import com.worksheet.attempt.AttemptStatus;
import com.worksheet.attempt.WorksheetAttemptRepository;
import com.worksheet.shared.codes.JoinCodeGenerator;
import java.util.List;
import java.util.Locale;
import java.util.Comparator;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class ClassroomService {
    private final com.worksheet.space.SpaceAccess spaces;
    private final com.worksheet.space.StudentDirectoryService directory;
    private final JoinCodeGenerator codes;
    private final ClassroomRepository classrooms;
    private final ClassroomMemberRepository members;
    private final WorksheetAssignmentRepository assignments;
    private final WorksheetAttemptService attempts;
    private final WorksheetAttemptRepository attemptRepository;
    private final UserRepository users;
    private final WorksheetAssignmentService assignmentService;
    private final WorksheetShareService shares;

    public ClassroomService(ClassroomRepository classrooms, ClassroomMemberRepository members,
                            WorksheetAssignmentRepository assignments, WorksheetAttemptService attempts,
                            JoinCodeGenerator codes, UserRepository users,
                            WorksheetAttemptRepository attemptRepository,
                            WorksheetAssignmentService assignmentService, WorksheetShareService shares, com.worksheet.space.SpaceAccess spaces, com.worksheet.space.StudentDirectoryService directory) {
        this.spaces=spaces; this.directory=directory;
        this.classrooms = classrooms;
        this.members = members;
        this.assignments = assignments;
        this.attempts = attempts;
        this.codes = codes;
        this.users = users;
        this.attemptRepository = attemptRepository;
        this.assignmentService = assignmentService;
        this.shares = shares;
    }

    public ClassroomResponse create(User teacher, CreateClassroomRequest request) {
        requireRole(teacher, UserRole.TEACHER);
        String name = request.name() == null ? "" : request.name().strip();
        if(name.isEmpty() || name.length() > 150) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Class name must contain 1 to 150 characters.");
        }
        var classroom=new Classroom(teacher,name,nextJoinCode());
        classroom.setSpaceId(spaces.currentSpace(teacher));
        classrooms.saveAndFlush(classroom);
        spaces.addLead(classroom);
        return toResponse(classroom,true);
    }

    public List<ClassroomResponse> getAll(User actor) {
        Long spaceId=spaces.currentSpace(actor);
        if(actor.getRole()==UserRole.TEACHER) {
            // Backfill only pre-space test/legacy objects; production rows are migrated by Flyway.
            classrooms.findByTeacher_IdOrderByCreatedAtDesc(actor.getId()).forEach(spaces::classSpace);
            return classrooms.findBySpaceIdOrderByCreatedAtDesc(spaceId).stream().filter(c -> spaces.canTeach(c,actor)).map(c -> toResponse(c,true)).toList();
        }
        return members.findByUser_IdAndLeftAtIsNullOrderByJoinedAtDesc(actor.getId()).stream()
            .filter(m -> java.util.Objects.equals(spaces.classSpace(m.getClassroom()),spaceId) && m.getClassroom().getArchivedAt()==null)
            .map(m -> toResponse(m.getClassroom(),false)).toList();
    }
    public ClassroomResponse getById(Long classroomId,User actor) {
        if(actor.getRole()==UserRole.TEACHER) return toResponse(spaces.requireClass(classroomId,actor,false),true);
        var classroom=classrooms.findById(classroomId).filter(c -> c.getArchivedAt()==null).orElseThrow(this::notFound);
        if(!spaces.selected(spaces.classSpace(classroom),actor) || !members.existsByClassroom_IdAndUser_IdAndLeftAtIsNull(classroomId,actor.getId())) throw notFound();
        return toResponse(classroom,false);
    }

    @Transactional
    public ClassroomResponse join(User user, JoinClassroomRequest request) {
        requireRole(user, UserRole.USER);
        if ("!".equals(user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Children are added to classes by their teacher.");
        }
        String code = normalizeCode(request.joinCode());
        Classroom classroom = classrooms.findByJoinCode(code)
            .filter(value -> value.getArchivedAt() == null).orElseThrow(() -> notFound());
        ClassroomMember membership = members.findByClassroom_IdAndUser_Id(classroom.getId(), user.getId()).orElse(null);
        if(membership != null && membership.getLeftAt() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This user is already an active class member.");
        }
        if(membership == null) { var added=new ClassroomMember(classroom,user); added.setStudentId(spaces.ensureStudent(spaces.classSpace(classroom),user).id); members.save(added); }
        else {
            membership.rejoin();
            members.save(membership);
        }
        return toResponse(classroom, false);
    }

    public List<ClassroomMemberResponse> getMembers(Long classroomId,User teacher) {
        spaces.requireClass(classroomId,teacher,false);
        return members.findByClassroom_IdOrderByJoinedAt(classroomId).stream().map(this::memberResponse).toList();
    }
    public ClassroomMemberResponse addStudent(Long classroomId,User teacher,StudentNameRequest request) {
        var classroom=requireOwnedClassroom(classroomId,teacher);
        var profile=request.studentId()==null?directory.create(classroom.getSpaceId(),request.name(),Boolean.TRUE.equals(request.allowDuplicate()),teacher):directory.get(classroom.getSpaceId(),request.studentId());
        if(profile.archivedAt!=null) throw notFound();
        var user=directory.user(profile);
        var membership=members.findByClassroom_IdAndUser_Id(classroomId,user.getId()).orElse(null);
        if(membership==null) membership=new ClassroomMember(classroom,user);
        else if(membership.getLeftAt()==null) throw new ResponseStatusException(HttpStatus.CONFLICT,"Student is already in this class.");
        else membership.rejoin();
        membership.setStudentId(profile.id);
        return memberResponse(members.save(membership));
    }
    public ClassroomMemberResponse renameStudent(Long classroomId,Long userId,User teacher,StudentNameRequest request) {
        var member=requireMember(classroomId,userId,teacher);
        var profile=profile(member);
        directory.update(profile.spaceId,profile.id,request.name(),false,teacher);
        return memberResponse(member);
    }

    public List<StudentTestResponse> getStudentTests(Long classroomId, Long userId, User teacher) {
        return studentTests(requireMember(classroomId, userId, teacher));
    }

    public ClassroomMemberResponse issueStudentCode(Long classroomId,Long userId,User teacher) {
        var member=requireMember(classroomId,userId,teacher); var p=profile(member);
        return credentialResponse(member,directory.credential(p.spaceId,p.id,false,teacher).code());
    }

    public String startTest(Long classroomId, Long worksheetId, User teacher) {
        requireOwnedClassroom(classroomId, teacher);
        String code = shares.shareCurrent(worksheetId, teacher);
        assignmentService.create(worksheetId, teacher, new CreateAssignmentRequest(classroomId, null));
        return code;
    }

    public ClassroomMemberResponse rotateStudentCode(Long classroomId,Long userId,User teacher) {
        var member=requireMember(classroomId,userId,teacher); var p=profile(member);
        return credentialResponse(member,directory.credential(p.spaceId,p.id,true,teacher).code());
    }
    private ClassroomMember requireMember(Long classroomId,Long userId,User teacher) {
        spaces.requireClass(classroomId,teacher,false);
        return members.findByClassroom_IdAndUser_Id(classroomId,userId).orElseThrow(this::notFound);
    }
    private com.worksheet.space.SpaceStudent profile(ClassroomMember member) {
        var p=spaces.ensureStudent(spaces.classSpace(member.getClassroom()),member.getUser());
        if(member.getStudentId()==null) member.setStudentId(p.id);
        return p;
    }
    public ClassroomMemberResponse student(Long classroomId,Long userId,User teacher) { return memberResponse(requireMember(classroomId,userId,teacher)); }
    private ClassroomMemberResponse credentialResponse(ClassroomMember member,String code) {
        var p=profile(member);
        return new ClassroomMemberResponse(member.getUser().getId(),p.name,null,member.getJoinedAt(),code,null,null,null,p.id,member.getLeftAt());
    }

    private List<StudentTestResponse> studentTests(ClassroomMember member) {
        return assignments.findByClassroom_IdAndUser_IdOrderByAssignedAtDesc(
                member.getClassroom().getId(), member.getUser().getId()).stream()
            .flatMap(assignment -> attemptRepository.findByAssignment_IdOrderByStartedAtDesc(assignment.getId()).stream()
                .map(attempt -> new StudentTestResponse(attempt.getId(), assignment.getId(),
                    assignment.getWorksheetRevision().getNameSnapshot(), attempt.getStatus(),
                    attempt.getTotalScore(), attempt.getMaxScore(), attempt.getStartedAt(), attempt.getCompletedAt())))
            .sorted(Comparator.comparing(StudentTestResponse::startedAt).reversed())
            .toList();
    }

    private ClassroomMemberResponse memberResponse(ClassroomMember member) {
        return credentialResponse(member,null);
    }

    private int percent(StudentTestResponse test) {
        return test.maxScore() == 0 ? 0 : (int) Math.round(100.0 * test.totalScore() / test.maxScore());
    }

    private String studentName(String name) {
        if (name == null || name.isBlank() || name.strip().length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Student name must contain 1 to 100 characters.");
        }
        return name.strip();
    }

    private String nextStudentCode() {
        String code;
        do { code = codes.generate(); } while (members.existsByStudentCode(code));
        return code;
    }

    @Transactional
    public void removeMember(Long classroomId, Long userId, User teacher) {
        requireOwnedClassroom(classroomId, teacher);
        ClassroomMember membership = members.findByClassroom_IdAndUser_IdAndLeftAtIsNull(classroomId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Class member not found."));
        membership.leave();
        members.save(membership);
        List<WorksheetAssignment> activeAssignments = assignments.findByClassroom_IdAndUser_IdAndRevokedAtIsNull(classroomId, userId);
        activeAssignments.forEach(WorksheetAssignment::revoke);
        assignments.saveAll(activeAssignments);
        attempts.abandonActiveForAssignments(activeAssignments);
    }

    public ClassroomResponse rotateJoinCode(Long classroomId, User teacher) {
        Classroom classroom = requireOwnedClassroom(classroomId, teacher);
        classroom.rotateJoinCode(nextJoinCode());
        return toResponse(classrooms.save(classroom), true);
    }

    public void archive(Long classroomId, User teacher) {
        requireRole(teacher, UserRole.TEACHER);
        Classroom classroom = spaces.requireClass(classroomId,teacher,false);
        if(classroom.getArchivedAt()!=null) return;
        classroom.archive();
        members.findByClassroom_IdAndLeftAtIsNullOrderByJoinedAt(classroomId)
            .forEach(ClassroomMember::leave);
        var affected = assignments.findByClassroom_Id(classroomId);
        affected.forEach(WorksheetAssignment::remove);
        attempts.abandonActiveForAssignments(affected);
    }

    public Classroom requireOwnedClassroom(Long classroomId,User teacher) { return spaces.requireClass(classroomId,teacher,true); }

    private ClassroomResponse toResponse(Classroom classroom, boolean includeJoinCode) {
        return new ClassroomResponse(classroom.getId(), classroom.getName(), classroom.getTeacher().getId(),
            classroom.getTeacher().getName(), includeJoinCode ? classroom.getJoinCode() : null, classroom.getCreatedAt(), classroom.getSpaceId(), classroom.getArchivedAt(),
            members.countByClassroom_IdAndLeftAtIsNull(classroom.getId()));
    }

    private String nextJoinCode() {
        String code;
        do {
            code = codes.generate();
        } while(classrooms.existsByJoinCode(code));
        return code;
    }

    private String normalizeCode(String code) {
        if(code == null || code.isBlank()) throw notFound();
        return code.strip().toUpperCase(Locale.ROOT);
    }

    private void requireRole(User user, UserRole role) {
        if(user.getRole() != role) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This account does not have permission for this action.");
    }

    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found.");
    }
}
