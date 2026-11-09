package com.worksheet.application.web;

import static org.springframework.http.HttpStatus.*;

import com.worksheet.auth.*;
import com.worksheet.teaching.space.*;
import com.worksheet.teaching.space.SpaceContextService.Selection;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@Transactional
public class SpaceController {
    private final com.worksheet.application.TeachingWorkflows workflows;
    private final com.worksheet.teaching.classroom.ClassroomService classroomService;
    private final SpaceContextService contexts;
    private final AuthSessionService sessions;
    private final SpaceAccess access;
    private final StudentDirectoryService directory;
    private final SpaceTeamService team;

    public SpaceController(
            SpaceContextService contexts,
            AuthSessionService sessions,
            SpaceAccess access,
            StudentDirectoryService directory,
            SpaceTeamService team,
            com.worksheet.teaching.classroom.ClassroomService classroomService,
            com.worksheet.application.TeachingWorkflows workflows) {
        this.workflows = workflows;
        this.contexts = contexts;
        this.classroomService = classroomService;
        this.sessions = sessions;
        this.access = access;
        this.directory = directory;
        this.team = team;
    }

    @GetMapping("/api/auth/context")
    public SpaceContextService.Context context(HttpServletRequest request) {
        return contexts.context(sessions.requireUser(request), request);
    }

    @PostMapping("/api/auth/context")
    public SpaceContextService.Selection select(
            @RequestBody SpaceContextService.Selection input, HttpServletRequest request) {
        return contexts.select(input, sessions.requireUser(request), request);
    }

    @GetMapping("/api/spaces")
    public List<SpaceContextService.SpaceView> spaces(HttpServletRequest request) {
        return context(request).spaces();
    }

    public record Rename(String name) {}

    @PatchMapping("/api/spaces/{spaceId}")
    public void rename(
            @PathVariable Long spaceId, @RequestBody Rename input, HttpServletRequest request) {
        contexts.rename(spaceId, input.name(), sessions.requireUser(request));
    }

    @GetMapping("/api/spaces/{spaceId}/members")
    public List<SpaceTeamService.TeamMember> members(
            @PathVariable Long spaceId, HttpServletRequest request) {
        return team.team(spaceId, sessions.requireUser(request));
    }

    public record Permission(boolean manageStudentAccess) {}

    @PatchMapping("/api/spaces/{spaceId}/members/{userId}")
    public void permission(
            @PathVariable Long spaceId,
            @PathVariable Long userId,
            @RequestBody Permission input,
            HttpServletRequest request) {
        team.permission(
                spaceId, userId, input.manageStudentAccess(), sessions.requireUser(request));
    }

    @PostMapping("/api/spaces/{spaceId}/owner/{userId}")
    public void transfer(
            @PathVariable Long spaceId, @PathVariable Long userId, HttpServletRequest request) {
        team.transfer(spaceId, userId, sessions.requireUser(request));
    }

    @DeleteMapping("/api/spaces/{spaceId}/members/{userId}")
    public void remove(
            @PathVariable Long spaceId, @PathVariable Long userId, HttpServletRequest request) {
        team.remove(spaceId, userId, sessions.requireUser(request));
    }

    @GetMapping("/api/spaces/{spaceId}/invitations")
    public List<SpaceTeamService.Invite> invitations(
            @PathVariable Long spaceId, HttpServletRequest request) {
        return team.invitations(spaceId, sessions.requireUser(request));
    }

    @PostMapping("/api/spaces/{spaceId}/invitations")
    public ResponseEntity<SpaceTeamService.CreatedInvite> invite(
            @PathVariable Long spaceId, HttpServletRequest request) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(team.invite(spaceId, sessions.requireUser(request)));
    }

    @DeleteMapping("/api/spaces/{spaceId}/invitations/{id}")
    public void revoke(
            @PathVariable Long spaceId, @PathVariable Long id, HttpServletRequest request) {
        team.revoke(spaceId, id, sessions.requireUser(request));
    }

    public record Token(String token) {}

    @PostMapping("/api/spaces/invitations/accept")
    public Selection accept(@RequestBody Token input, HttpServletRequest request) {
        Long id = team.accept(input.token(), sessions.requireUser(request));
        request.getSession().setAttribute("auth.spaceId", id);
        return new Selection(id);
    }

    @GetMapping("/api/spaces/{spaceId}/students")
    public List<StudentDirectoryService.Student> students(
            @PathVariable Long spaceId, HttpServletRequest request) {
        return directory.list(spaceId, sessions.requireUser(request));
    }

    public record NewStudent(String name, Boolean allowDuplicate) {}

    @PostMapping("/api/spaces/{spaceId}/students")
    public StudentDirectoryService.Student create(
            @PathVariable Long spaceId, @RequestBody NewStudent input, HttpServletRequest request) {
        return directory.response(
                directory.create(
                        spaceId,
                        input.name(),
                        Boolean.TRUE.equals(input.allowDuplicate()),
                        sessions.requireUser(request)));
    }

    public record BulkRow(String name, Long studentId, Boolean allowDuplicate) {}

    public record BulkInput(Long classroomId, List<BulkRow> rows) {}

    @PostMapping("/api/spaces/{spaceId}/students/bulk")
    public List<StudentDirectoryService.Student> bulk(
            @PathVariable Long spaceId, @RequestBody BulkInput input, HttpServletRequest request) {
        var actor = sessions.requireUser(request);
        access.teacher(spaceId, actor);
        if (input.rows() == null || input.rows().isEmpty() || input.rows().size() > 200)
            throw new org.springframework.web.server.ResponseStatusException(
                    BAD_REQUEST, "Provide 1 to 200 students.");
        if (input.classroomId() != null
                && !spaceId.equals(
                        access.requireClass(input.classroomId(), actor, true).getSpaceId()))
            throw SpaceAccess.missing();
        var result = new ArrayList<StudentDirectoryService.Student>();
        var seen = new HashSet<Long>();
        for (var row : input.rows()) {
            var student =
                    row.studentId() == null
                            ? directory.create(
                                    spaceId,
                                    row.name(),
                                    Boolean.TRUE.equals(row.allowDuplicate()),
                                    actor)
                            : directory.get(spaceId, row.studentId());
            if (!seen.add(student.getId()))
                throw new org.springframework.web.server.ResponseStatusException(
                        CONFLICT, "The same student was selected more than once.");
            if (input.classroomId() != null)
                classroomService.addStudent(
                        input.classroomId(),
                        actor,
                        new com.worksheet.teaching.classroom.StudentNameRequest(
                                null, student.getId(), false));
            result.add(directory.response(student));
        }
        return result;
    }

    public record UpdateStudent(String name, Boolean archive) {}

    @PatchMapping("/api/spaces/{spaceId}/students/{id}")
    public StudentDirectoryService.Student update(
            @PathVariable Long spaceId,
            @PathVariable Long id,
            @RequestBody UpdateStudent input,
            HttpServletRequest request) {
        return workflows.updateStudent(
                spaceId,
                id,
                input.name(),
                Boolean.TRUE.equals(input.archive()),
                sessions.requireUser(request));
    }

    @PostMapping("/api/spaces/{spaceId}/students/{id}/credential")
    public ResponseEntity<StudentDirectoryService.AccessCard> credential(
            @PathVariable Long spaceId, @PathVariable Long id, HttpServletRequest request) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(directory.credential(spaceId, id, false, sessions.requireUser(request)));
    }

    @PostMapping("/api/spaces/{spaceId}/students/{id}/credential/rotate")
    public ResponseEntity<StudentDirectoryService.AccessCard> rotate(
            @PathVariable Long spaceId, @PathVariable Long id, HttpServletRequest request) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(directory.credential(spaceId, id, true, sessions.requireUser(request)));
    }

    @GetMapping("/api/classes/{classroomId}/teachers")
    public List<SpaceTeamService.TeamMember> classTeachers(
            @PathVariable Long classroomId, HttpServletRequest request) {
        return team.classTeachers(classroomId, sessions.requireUser(request));
    }

    public record ClassTeacherInput(Long userId, Boolean lead) {}

    @PostMapping("/api/classes/{classroomId}/teachers")
    public void classTeacher(
            @PathVariable Long classroomId,
            @RequestBody ClassTeacherInput input,
            HttpServletRequest request) {
        team.classTeacher(
                classroomId,
                input.userId(),
                false,
                Boolean.TRUE.equals(input.lead()),
                sessions.requireUser(request));
    }

    @DeleteMapping("/api/classes/{classroomId}/teachers/{userId}")
    public void removeClassTeacher(
            @PathVariable Long classroomId, @PathVariable Long userId, HttpServletRequest request) {
        team.classTeacher(classroomId, userId, true, false, sessions.requireUser(request));
    }
}
