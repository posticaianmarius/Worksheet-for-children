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
                            WorksheetAssignmentService assignmentService, WorksheetShareService shares) {
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
        return toResponse(classrooms.save(new Classroom(teacher, name, nextJoinCode())), true);
    }

    public List<ClassroomResponse> getAll(User actor) {
        if(actor.getRole() == UserRole.TEACHER) {
            return classrooms.findByTeacher_IdOrderByCreatedAtDesc(actor.getId()).stream()
                .filter(classroom -> classroom.getArchivedAt() == null)
                .map(classroom -> toResponse(classroom, true)).toList();
        }
        return members.findByUser_IdAndLeftAtIsNullOrderByJoinedAtDesc(actor.getId()).stream()
            .filter(member -> member.getClassroom().getArchivedAt() == null)
            .map(member -> toResponse(member.getClassroom(), false)).toList();
    }

    public ClassroomResponse getById(Long classroomId, User actor) {
        Classroom classroom = classrooms.findById(classroomId)
            .filter(value -> value.getArchivedAt() == null)
            .orElseThrow(() -> notFound());
        boolean teacher = classroom.getTeacher().getId().equals(actor.getId());
        boolean member = members.existsByClassroom_IdAndUser_IdAndLeftAtIsNull(classroomId, actor.getId());
        if(!teacher && !member) throw notFound();
        return toResponse(classroom, teacher);
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
        if(membership == null) members.save(new ClassroomMember(classroom, user));
        else {
            membership.rejoin();
            members.save(membership);
        }
        return toResponse(classroom, false);
    }

    public List<ClassroomMemberResponse> getMembers(Long classroomId, User teacher) {
        requireOwnedClassroom(classroomId, teacher);
        return members.findByClassroom_IdAndLeftAtIsNullOrderByJoinedAt(classroomId).stream()
            .map(this::memberResponse)
            .toList();
    }

    public ClassroomMemberResponse addStudent(Long classroomId, User teacher, StudentNameRequest request) {
        Classroom classroom = requireOwnedClassroom(classroomId, teacher);
        // These identities only store progress. Children never need an email or password.
        User child = users.save(new User(studentName(request.name()),
            UUID.randomUUID() + "@student.invalid", "!", UserRole.USER));
        ClassroomMember member = new ClassroomMember(classroom, child);
        member.setStudentCode(nextStudentCode());
        return memberResponse(members.save(member));
    }

    public ClassroomMemberResponse renameStudent(Long classroomId, Long userId, User teacher, StudentNameRequest request) {
        ClassroomMember member = requireMember(classroomId, userId, teacher);
        if (member.getLeftAt() != null) throw notFound();
        if (!"!".equals(member.getUser().getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only teacher-managed children can be renamed.");
        }
        member.getUser().rename(studentName(request.name()));
        return memberResponse(member);
    }

    public List<StudentTestResponse> getStudentTests(Long classroomId, Long userId, User teacher) {
        return studentTests(requireMember(classroomId, userId, teacher));
    }

    public ClassroomMemberResponse issueStudentCode(Long classroomId, Long userId, User teacher) {
        ClassroomMember member = requireMember(classroomId, userId, teacher);
        if (member.getLeftAt() != null) throw notFound();
        if (member.getStudentCode() == null) member.setStudentCode(nextStudentCode());
        return memberResponse(members.save(member));
    }

    public String startTest(Long classroomId, Long worksheetId, User teacher) {
        requireOwnedClassroom(classroomId, teacher);
        String code = shares.shareCurrent(worksheetId, teacher);
        assignmentService.create(worksheetId, teacher, new CreateAssignmentRequest(classroomId, null));
        return code;
    }

    public ClassroomMemberResponse rotateStudentCode(Long classroomId, Long userId, User teacher) {
        ClassroomMember member = requireMember(classroomId, userId, teacher);
        if (member.getLeftAt() != null || member.getClassroom().getArchivedAt() != null) throw notFound();
        member.setStudentCode(nextStudentCode());
        return memberResponse(members.save(member));
    }

    private ClassroomMember requireMember(Long classroomId, Long userId, User teacher) {
        requireOwnedClassroom(classroomId, teacher);
        return members.findByClassroom_IdAndUser_Id(classroomId, userId).orElseThrow(this::notFound);
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
        List<StudentTestResponse> completed = studentTests(member).stream()
            .filter(test -> test.status() == AttemptStatus.COMPLETED)
            .sorted(Comparator.comparing(StudentTestResponse::completedAt).reversed()).toList();
        Integer last = completed.isEmpty() ? null : percent(completed.getFirst());
        Integer average = completed.isEmpty() ? null : (int) Math.round(
            completed.stream().mapToInt(this::percent).average().orElse(0));
        String worst = completed.stream().min(Comparator.comparingInt(this::percent))
            .map(StudentTestResponse::name).orElse(null);
        return new ClassroomMemberResponse(member.getUser().getId(), member.getUser().getName(),
            "!".equals(member.getUser().getPasswordHash()) ? null : member.getUser().getEmail(), member.getJoinedAt(),
            member.getStudentCode(), last, average, worst);
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
        Classroom classroom = classrooms.findByIdAndTeacher_Id(classroomId, teacher.getId())
            .orElseThrow(this::notFound);
        classroom.archive();
        members.findByClassroom_IdAndLeftAtIsNullOrderByJoinedAt(classroomId)
            .forEach(ClassroomMember::leave);
        var affected = assignments.findByClassroom_Id(classroomId);
        affected.forEach(WorksheetAssignment::remove);
        attempts.abandonActiveForAssignments(affected);
    }

    public Classroom requireOwnedClassroom(Long classroomId, User teacher) {
        requireRole(teacher, UserRole.TEACHER);
        return classrooms.findByIdAndTeacher_Id(classroomId, teacher.getId())
            .filter(value -> value.getArchivedAt() == null)
            .orElseThrow(() -> notFound());
    }

    private ClassroomResponse toResponse(Classroom classroom, boolean includeJoinCode) {
        return new ClassroomResponse(classroom.getId(), classroom.getName(), classroom.getTeacher().getId(),
            classroom.getTeacher().getName(), includeJoinCode ? classroom.getJoinCode() : null, classroom.getCreatedAt());
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
