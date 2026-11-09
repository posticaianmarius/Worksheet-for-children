package com.worksheet.teaching.space;

import static org.springframework.http.HttpStatus.*;

import com.worksheet.auth.*;
import com.worksheet.teaching.classroom.*;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.stereotype.Service;
import org.springframework.web.context.request.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

/** Shared authorization boundary. A resource's space is always checked on the server. */
@Service
public class SpaceAccess {
    final TeachingSpaceRepository spaces;
    final SpaceTeacherRepository teachers;
    final SpaceStudentRepository students;
    final ClassTeacherRepository classTeachers;
    final StudentCredentialRepository credentials;
    final ClassroomRepository classrooms;
    final com.worksheet.auth.api.UserAccounts users;

    public SpaceAccess(
            TeachingSpaceRepository spaces,
            SpaceTeacherRepository teachers,
            SpaceStudentRepository students,
            ClassTeacherRepository classTeachers,
            StudentCredentialRepository credentials,
            ClassroomRepository classrooms,
            com.worksheet.auth.api.UserAccounts users) {
        this.spaces = spaces;
        this.teachers = teachers;
        this.students = students;
        this.classTeachers = classTeachers;
        this.credentials = credentials;
        this.classrooms = classrooms;
        this.users = users;
    }

    public HttpServletRequest request() {
        var attrs = RequestContextHolder.getRequestAttributes();
        return attrs instanceof ServletRequestAttributes servlet ? servlet.getRequest() : null;
    }

    public TeachingSpace personal(User teacher) {
        return spaces.findByPersonalOwnerId(teacher.getId())
                .orElseGet(
                        () -> {
                            var space = new TeachingSpace();
                            space.personalOwnerId = teacher.getId();
                            space.name = teacher.getName() + "'s teaching space";
                            space.createdAt = Instant.now();
                            spaces.saveAndFlush(space);
                            var member = new SpaceTeacher();
                            member.spaceId = space.id;
                            member.userId = teacher.getId();
                            member.owner = true;
                            member.manageStudentAccess = true;
                            teachers.save(member);
                            return space;
                        });
    }

    public Long classSpace(Classroom classroom) {
        if (classroom.getSpaceId() == null) {
            classroom.setSpaceId(personal(classroom.getTeacher()).id);
            classrooms.save(classroom);
            var lead = new ClassTeacher();
            lead.classroomId = classroom.getId();
            lead.userId = classroom.getTeacher().getId();
            if (classTeachers.findByClassroomIdAndUserId(lead.classroomId, lead.userId).isEmpty())
                classTeachers.save(lead);
        }
        return classroom.getSpaceId();
    }

    public void addLead(Classroom classroom) {
        var lead = new ClassTeacher();
        lead.classroomId = classroom.getId();
        lead.userId = classroom.getTeacher().getId();
        classTeachers.save(lead);
    }

    public SpaceStudent ensureStudent(Long spaceId, User user) {
        return students.findBySpaceIdAndUserId(spaceId, user.getId())
                .orElseGet(
                        () -> {
                            var profile = new SpaceStudent();
                            profile.spaceId = spaceId;
                            profile.userId = user.getId();
                            profile.name = user.getName();
                            return students.saveAndFlush(profile);
                        });
    }

    public SpaceTeacher teacher(Long spaceId, User actor) {
        if (actor.getRole() != UserRole.TEACHER) throw missing();
        return teachers.findBySpaceIdAndUserId(spaceId, actor.getId())
                .orElseThrow(SpaceAccess::missing);
    }

    public void owner(Long spaceId, User actor) {
        if (!teacher(spaceId, actor).owner)
            throw new ResponseStatusException(
                    FORBIDDEN, "Only the teaching-space owner can do this.");
    }

    public void credentialManager(Long spaceId, User actor) {
        var member = teacher(spaceId, actor);
        if (!member.owner && !member.manageStudentAccess)
            throw new ResponseStatusException(
                    FORBIDDEN, "Student login access must be granted by the teaching-space owner.");
    }

    public Long currentSpace(User actor) {
        var request = request();
        var session = request == null ? null : request.getSession(false);
        String raw = request == null ? null : request.getHeader("X-Space-Id");
        Long requested = null;
        if (raw != null && !raw.isBlank()) {
            try {
                requested = Long.valueOf(raw);
            } catch (NumberFormatException ex) {
                throw missing();
            }
        } else if (session != null && session.getAttribute("auth.spaceId") instanceof Long id)
            requested = id;
        // Code-authenticated children cannot switch to another space, even with a crafted header.
        if (session != null && session.getAttribute("auth.studentCode") instanceof String code) {
            var credential = credentials.findByCode(code).orElseThrow(SpaceAccess::missing);
            var profile =
                    students.findById(credential.studentId)
                            .filter(s -> s.archivedAt == null && s.userId.equals(actor.getId()))
                            .orElseThrow(SpaceAccess::missing);
            if (requested != null && !requested.equals(profile.spaceId)) throw missing();
            return profile.spaceId;
        }
        if (actor.getRole() == UserRole.TEACHER) {
            var options = teachers.findByUserId(actor.getId());
            if (options.isEmpty()) options = List.of(teacher(personal(actor).id, actor));
            if (requested != null) {
                teacher(requested, actor);
                return requested;
            }
            return options.getFirst().spaceId;
        }
        var options =
                students.findByUserId(actor.getId()).stream()
                        .filter(s -> s.archivedAt == null)
                        .toList();
        if (requested != null) {
            final Long selected = requested;
            if (options.stream().noneMatch(s -> s.spaceId.equals(selected))) throw missing();
            return selected;
        }
        if (options.size() > 1)
            throw new ResponseStatusException(CONFLICT, "Choose a teaching space.");
        return options.isEmpty() ? null : options.getFirst().spaceId;
    }

    public boolean selected(Long spaceId, User actor) {
        return Objects.equals(currentSpace(actor), spaceId);
    }

    public boolean canTeach(Classroom classroom, User actor) {
        if (actor.getRole() != UserRole.TEACHER) return false;
        Long spaceId = classSpace(classroom);
        var member = teachers.findBySpaceIdAndUserId(spaceId, actor.getId()).orElse(null);
        return member != null
                && (member.owner
                        || classTeachers
                                .findByClassroomIdAndUserId(classroom.getId(), actor.getId())
                                .isPresent());
    }

    public Classroom requireClass(Long id, User actor, boolean writable) {
        var classroom = classrooms.findById(id).orElseThrow(SpaceAccess::missing);
        if (!canTeach(classroom, actor) || !selected(classSpace(classroom), actor)) throw missing();
        if (writable && classroom.getArchivedAt() != null)
            throw new ResponseStatusException(CONFLICT, "Archived classes are read-only.");
        return classroom;
    }

    public boolean isOwner(Long spaceId, User actor) {
        return teachers.findBySpaceIdAndUserId(spaceId, actor.getId())
                .map(m -> m.owner)
                .orElse(false);
    }

    public boolean isTeacher(Long spaceId, User actor) {
        return teachers.findBySpaceIdAndUserId(spaceId, actor.getId()).isPresent();
    }

    public boolean isActiveStudent(Long spaceId, Long userId) {
        return students.findBySpaceIdAndUserId(spaceId, userId)
                .filter(s -> s.archivedAt == null)
                .isPresent();
    }

    public static ResponseStatusException missing() {
        return new ResponseStatusException(NOT_FOUND, "Resource not found in this teaching space.");
    }
}
