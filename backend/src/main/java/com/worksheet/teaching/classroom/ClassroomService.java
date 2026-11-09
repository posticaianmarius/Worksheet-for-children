package com.worksheet.teaching.classroom;

import com.worksheet.auth.User;
import com.worksheet.auth.UserRole;
import com.worksheet.shared.codes.JoinCodeGenerator;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@Service
@Transactional
public class ClassroomService {
    private final com.worksheet.teaching.space.SpaceAccess spaces;
    private final com.worksheet.teaching.space.StudentDirectoryService directory;
    private final JoinCodeGenerator codes;
    private final ClassroomRepository classrooms;
    private final ClassroomMemberRepository members;

    public ClassroomService(
            ClassroomRepository classrooms,
            ClassroomMemberRepository members,
            JoinCodeGenerator codes,
            com.worksheet.teaching.space.SpaceAccess spaces,
            com.worksheet.teaching.space.StudentDirectoryService directory) {
        this.classrooms = classrooms;
        this.members = members;
        this.codes = codes;
        this.spaces = spaces;
        this.directory = directory;
    }

    public ClassroomResponse create(User teacher, CreateClassroomRequest request) {
        requireRole(teacher, UserRole.TEACHER);
        String name = request.name() == null ? "" : request.name().strip();
        if (name.isEmpty() || name.length() > 150) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Class name must contain 1 to 150 characters.");
        }
        var classroom = new Classroom(teacher, name, nextJoinCode());
        classroom.setSpaceId(spaces.currentSpace(teacher));
        classrooms.saveAndFlush(classroom);
        spaces.addLead(classroom);
        return toResponse(classroom, true);
    }

    public List<ClassroomResponse> getAll(User actor) {
        Long spaceId = spaces.currentSpace(actor);
        if (actor.getRole() == UserRole.TEACHER) {
            // Backfill only pre-space test/legacy objects; production rows are migrated by Flyway.
            classrooms
                    .findByTeacher_IdOrderByCreatedAtDesc(actor.getId())
                    .forEach(spaces::classSpace);
            return classrooms.findBySpaceIdOrderByCreatedAtDesc(spaceId).stream()
                    .filter(c -> spaces.canTeach(c, actor))
                    .map(c -> toResponse(c, true))
                    .toList();
        }
        return members.findByUser_IdAndLeftAtIsNullOrderByJoinedAtDesc(actor.getId()).stream()
                .filter(
                        m ->
                                java.util.Objects.equals(
                                                spaces.classSpace(m.getClassroom()), spaceId)
                                        && m.getClassroom().getArchivedAt() == null)
                .map(m -> toResponse(m.getClassroom(), false))
                .toList();
    }

    public ClassroomResponse getById(Long classroomId, User actor) {
        if (actor.getRole() == UserRole.TEACHER)
            return toResponse(spaces.requireClass(classroomId, actor, false), true);
        var classroom =
                classrooms
                        .findById(classroomId)
                        .filter(c -> c.getArchivedAt() == null)
                        .orElseThrow(this::notFound);
        if (!spaces.selected(spaces.classSpace(classroom), actor)
                || !members.existsByClassroom_IdAndUser_IdAndLeftAtIsNull(
                        classroomId, actor.getId())) throw notFound();
        return toResponse(classroom, false);
    }

    @Transactional
    public ClassroomResponse join(User user, JoinClassroomRequest request) {
        requireRole(user, UserRole.USER);
        if ("!".equals(user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Children are added to classes by their teacher.");
        }
        String code = normalizeCode(request.joinCode());
        Classroom classroom =
                classrooms
                        .findByJoinCode(code)
                        .filter(value -> value.getArchivedAt() == null)
                        .orElseThrow(() -> notFound());
        ClassroomMember membership =
                members.findByClassroom_IdAndUser_Id(classroom.getId(), user.getId()).orElse(null);
        if (membership != null && membership.getLeftAt() == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "This user is already an active class member.");
        }
        if (membership == null) {
            var added = new ClassroomMember(classroom, user);
            added.setStudentId(spaces.ensureStudent(spaces.classSpace(classroom), user).getId());
            members.save(added);
        } else {
            membership.rejoin();
            members.save(membership);
        }
        return toResponse(classroom, false);
    }

    public List<ClassroomMemberResponse> getMembers(Long classroomId, User teacher) {
        spaces.requireClass(classroomId, teacher, false);
        var roster = members.findByClassroom_IdOrderByJoinedAt(classroomId);
        var profiles =
                directory.profiles(
                        roster.stream()
                                .map(ClassroomMember::getStudentId)
                                .filter(java.util.Objects::nonNull)
                                .toList());
        return roster.stream()
                .map(
                        m -> {
                            var p = profiles.get(m.getStudentId());
                            if (p == null) p = profile(m);
                            return new ClassroomMemberResponse(
                                    m.getUser().getId(),
                                    p.getName(),
                                    null,
                                    m.getJoinedAt(),
                                    null,
                                    null,
                                    null,
                                    null,
                                    p.getId(),
                                    m.getLeftAt());
                        })
                .toList();
    }

    public ClassroomMemberResponse addStudent(
            Long classroomId, User teacher, StudentNameRequest request) {
        var classroom = requireOwnedClassroom(classroomId, teacher);
        var profile =
                request.studentId() == null
                        ? directory.create(
                                classroom.getSpaceId(),
                                request.name(),
                                Boolean.TRUE.equals(request.allowDuplicate()),
                                teacher)
                        : directory.get(classroom.getSpaceId(), request.studentId());
        if (profile.getArchivedAt() != null) throw notFound();
        var user = directory.user(profile);
        var membership =
                members.findByClassroom_IdAndUser_Id(classroomId, user.getId()).orElse(null);
        if (membership == null) membership = new ClassroomMember(classroom, user);
        else if (membership.getLeftAt() == null)
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Student is already in this class.");
        else membership.rejoin();
        membership.setStudentId(profile.getId());
        return memberResponse(members.save(membership));
    }

    public ClassroomMemberResponse renameStudent(
            Long classroomId, Long userId, User teacher, StudentNameRequest request) {
        var member = requireMember(classroomId, userId, teacher);
        var profile = profile(member);
        directory.update(profile.getSpaceId(), profile.getId(), request.name(), false, teacher);
        return memberResponse(member);
    }

    public ClassroomMemberResponse issueStudentCode(Long classroomId, Long userId, User teacher) {
        var member = requireMember(classroomId, userId, teacher);
        var p = profile(member);
        return credentialResponse(
                member, directory.credential(p.getSpaceId(), p.getId(), false, teacher).code());
    }

    public ClassroomMemberResponse rotateStudentCode(Long classroomId, Long userId, User teacher) {
        var member = requireMember(classroomId, userId, teacher);
        var p = profile(member);
        return credentialResponse(
                member, directory.credential(p.getSpaceId(), p.getId(), true, teacher).code());
    }

    private ClassroomMember requireMember(Long classroomId, Long userId, User teacher) {
        spaces.requireClass(classroomId, teacher, false);
        return members.findByClassroom_IdAndUser_Id(classroomId, userId)
                .orElseThrow(this::notFound);
    }

    private com.worksheet.teaching.space.SpaceStudent profile(ClassroomMember member) {
        var p = spaces.ensureStudent(spaces.classSpace(member.getClassroom()), member.getUser());
        if (member.getStudentId() == null) member.setStudentId(p.getId());
        return p;
    }

    public ClassroomMemberResponse student(Long classroomId, Long userId, User teacher) {
        return memberResponse(requireMember(classroomId, userId, teacher));
    }

    private ClassroomMemberResponse credentialResponse(ClassroomMember member, String code) {
        var p = profile(member);
        return new ClassroomMemberResponse(
                member.getUser().getId(),
                p.getName(),
                null,
                member.getJoinedAt(),
                code,
                null,
                null,
                null,
                p.getId(),
                member.getLeftAt());
    }

    private ClassroomMemberResponse memberResponse(ClassroomMember member) {
        return credentialResponse(member, null);
    }

    @Transactional
    public void removeMember(Long classroomId, Long userId, User teacher) {
        requireOwnedClassroom(classroomId, teacher);
        ClassroomMember membership =
                members.findByClassroom_IdAndUser_IdAndLeftAtIsNull(classroomId, userId)
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND, "Class member not found."));
        membership.leave();
        members.save(membership);
    }

    public ClassroomResponse rotateJoinCode(Long classroomId, User teacher) {
        Classroom classroom = requireOwnedClassroom(classroomId, teacher);
        classroom.rotateJoinCode(nextJoinCode());
        return toResponse(classrooms.save(classroom), true);
    }

    public void archive(Long classroomId, User teacher) {
        requireRole(teacher, UserRole.TEACHER);
        Classroom classroom = spaces.requireClass(classroomId, teacher, false);
        if (classroom.getArchivedAt() != null) return;
        classroom.archive();
        members.findByClassroom_IdAndLeftAtIsNullOrderByJoinedAt(classroomId)
                .forEach(ClassroomMember::leave);
    }

    public void requireHistoricalMember(Long classroomId, Long userId, User teacher) {
        requireMember(classroomId, userId, teacher);
    }

    public Classroom requireOwnedClassroom(Long classroomId, User teacher) {
        return spaces.requireClass(classroomId, teacher, true);
    }

    private ClassroomResponse toResponse(Classroom classroom, boolean includeJoinCode) {
        return new ClassroomResponse(
                classroom.getId(),
                classroom.getName(),
                classroom.getTeacher().getId(),
                classroom.getTeacher().getName(),
                includeJoinCode ? classroom.getJoinCode() : null,
                classroom.getCreatedAt(),
                classroom.getSpaceId(),
                classroom.getArchivedAt(),
                members.countByClassroom_IdAndLeftAtIsNull(classroom.getId()));
    }

    private String nextJoinCode() {
        String code;
        do {
            code = codes.generate();
        } while (classrooms.existsByJoinCode(code));
        return code;
    }

    private String normalizeCode(String code) {
        if (code == null || code.isBlank()) throw notFound();
        return code.strip().toUpperCase(Locale.ROOT);
    }

    private void requireRole(User user, UserRole role) {
        if (user.getRole() != role)
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "This account does not have permission for this action.");
    }

    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found.");
    }
}
