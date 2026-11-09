package com.worksheet.application.web;

import com.worksheet.auth.AuthSessionService;
import com.worksheet.auth.UserRole;
import com.worksheet.learning.access.*;
import com.worksheet.learning.sharing.*;
import com.worksheet.learning.sharing.WorksheetShareResponse;
import com.worksheet.teaching.classroom.*;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/classes")
public class ClassroomController {
    private final com.worksheet.application.TeachingWorkflows workflows;
    private final ClassroomService service;
    private final AuthSessionService sessions;

    public ClassroomController(
            ClassroomService service,
            AuthSessionService sessions,
            com.worksheet.application.TeachingWorkflows workflows) {
        this.workflows = workflows;
        this.service = service;
        this.sessions = sessions;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ClassroomResponse create(
            @RequestBody CreateClassroomRequest body, HttpServletRequest request) {
        return service.create(sessions.requireRole(request, UserRole.TEACHER), body);
    }

    @GetMapping
    public List<ClassroomResponse> getAll(HttpServletRequest request) {
        return service.getAll(sessions.requireUser(request));
    }

    @GetMapping("/{classroomId}")
    public ClassroomResponse getById(@PathVariable Long classroomId, HttpServletRequest request) {
        return service.getById(classroomId, sessions.requireUser(request));
    }

    @PostMapping("/join")
    @ResponseStatus(HttpStatus.CREATED)
    public ClassroomResponse join(
            @RequestBody JoinClassroomRequest body, HttpServletRequest request) {
        return service.join(sessions.requireRole(request, UserRole.USER), body);
    }

    @DeleteMapping("/{classroomId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void archive(@PathVariable Long classroomId, HttpServletRequest request) {
        workflows.archive(classroomId, sessions.requireRole(request, UserRole.TEACHER));
    }

    @GetMapping("/{classroomId}/members")
    public List<ClassroomMemberResponse> getMembers(
            @PathVariable Long classroomId, HttpServletRequest request) {
        return service.getMembers(classroomId, sessions.requireRole(request, UserRole.TEACHER));
    }

    @DeleteMapping("/{classroomId}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(
            @PathVariable Long classroomId, @PathVariable Long userId, HttpServletRequest request) {
        workflows.removeMember(
                classroomId, userId, sessions.requireRole(request, UserRole.TEACHER));
    }

    @PostMapping("/{classroomId}/members")
    @ResponseStatus(HttpStatus.CREATED)
    public ClassroomMemberResponse addStudent(
            @PathVariable Long classroomId,
            @RequestBody StudentNameRequest body,
            HttpServletRequest request) {
        return service.addStudent(
                classroomId, sessions.requireRole(request, UserRole.TEACHER), body);
    }

    @PatchMapping("/{classroomId}/members/{userId}")
    public ClassroomMemberResponse renameStudent(
            @PathVariable Long classroomId,
            @PathVariable Long userId,
            @RequestBody StudentNameRequest body,
            HttpServletRequest request) {
        return service.renameStudent(
                classroomId, userId, sessions.requireRole(request, UserRole.TEACHER), body);
    }

    @GetMapping("/{classroomId}/members/{userId}/tests")
    public List<StudentTestResponse> getStudentTests(
            @PathVariable Long classroomId, @PathVariable Long userId, HttpServletRequest request) {
        return workflows.studentTests(
                classroomId, userId, sessions.requireRole(request, UserRole.TEACHER));
    }

    @PostMapping("/{classroomId}/tests")
    @ResponseStatus(HttpStatus.CREATED)
    public WorksheetShareResponse startTest(
            @PathVariable Long classroomId,
            @RequestBody StartTestRequest body,
            HttpServletRequest request) {
        return new WorksheetShareResponse(
                workflows.startTest(
                        classroomId,
                        body.worksheetId(),
                        sessions.requireRole(request, UserRole.TEACHER)));
    }

    @GetMapping("/{classroomId}/members/{userId}")
    public ClassroomMemberResponse student(
            @PathVariable Long classroomId, @PathVariable Long userId, HttpServletRequest request) {
        return service.student(
                classroomId, userId, sessions.requireRole(request, UserRole.TEACHER));
    }

    public record StartTestRequest(Long worksheetId) {}

    @PostMapping("/{classroomId}/members/{userId}/code")
    public ClassroomMemberResponse issueStudentCode(
            @PathVariable Long classroomId, @PathVariable Long userId, HttpServletRequest request) {
        return service.issueStudentCode(
                classroomId, userId, sessions.requireRole(request, UserRole.TEACHER));
    }

    @PostMapping("/{classroomId}/join-code/rotate")
    public ClassroomResponse rotateJoinCode(
            @PathVariable Long classroomId, HttpServletRequest request) {
        return service.rotateJoinCode(classroomId, sessions.requireRole(request, UserRole.TEACHER));
    }

    @PostMapping("/{classroomId}/members/{userId}/code/rotate")
    public ClassroomMemberResponse rotateStudentCode(
            @PathVariable Long classroomId, @PathVariable Long userId, HttpServletRequest request) {
        return service.rotateStudentCode(
                classroomId, userId, sessions.requireRole(request, UserRole.TEACHER));
    }
}
