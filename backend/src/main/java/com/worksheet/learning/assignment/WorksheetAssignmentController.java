package com.worksheet.learning.assignment;

import com.worksheet.auth.AuthSessionService;
import com.worksheet.auth.UserRole;
import com.worksheet.learning.legacy.result.CreateWorksheetResultRequest;
import com.worksheet.learning.legacy.result.WorksheetResultResponse;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class WorksheetAssignmentController {
    private final WorksheetAssignmentService service;
    private final AuthSessionService sessions;
    private final AssignmentReportService reports;

    public WorksheetAssignmentController(
            WorksheetAssignmentService service,
            AuthSessionService sessions,
            AssignmentReportService reports) {
        this.service = service;
        this.sessions = sessions;
        this.reports = reports;
    }

    @GetMapping("/assignments/report")
    public List<AssignmentReportResponse> report(
            @RequestParam(defaultValue = "false") boolean includeRemoved,
            @RequestParam(required = false) Long classroomId,
            HttpServletRequest request) {
        return reports.getReport(
                sessions.requireRole(request, UserRole.TEACHER), includeRemoved, classroomId);
    }

    @GetMapping("/assignments/batches/{batchId}")
    public List<WorksheetAssignmentResponse> delivery(
            @PathVariable java.util.UUID batchId, HttpServletRequest request) {
        return service.delivery(batchId, sessions.requireUser(request));
    }

    @DeleteMapping("/assignments/batches/{batchId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeBatch(@PathVariable java.util.UUID batchId, HttpServletRequest request) {
        service.removeBatch(batchId, sessions.requireRole(request, UserRole.TEACHER));
    }

    @DeleteMapping("/assignments/classes/{classroomId}/revisions/{revisionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeGroup(
            @PathVariable Long classroomId,
            @PathVariable Long revisionId,
            HttpServletRequest request) {
        service.removeGroup(
                classroomId, revisionId, sessions.requireRole(request, UserRole.TEACHER));
    }

    @DeleteMapping("/assignments/direct/revisions/{revisionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeDirectGroup(@PathVariable Long revisionId, HttpServletRequest request) {
        service.removeGroup(null, revisionId, sessions.requireRole(request, UserRole.TEACHER));
    }

    @PostMapping("/worksheets/{worksheetId}/assignments/preview")
    public WorksheetAssignmentService.Preview preview(
            @PathVariable Long worksheetId, HttpServletRequest request) {
        return service.preview(worksheetId, sessions.requireRole(request, UserRole.TEACHER));
    }

    @PostMapping("/worksheets/{worksheetId}/assignments")
    @ResponseStatus(HttpStatus.CREATED)
    public List<WorksheetAssignmentResponse> create(
            @PathVariable Long worksheetId,
            @RequestBody CreateAssignmentRequest body,
            HttpServletRequest request) {
        return service.create(worksheetId, sessions.requireRole(request, UserRole.TEACHER), body);
    }

    @GetMapping("/assignments")
    public List<WorksheetAssignmentResponse> getAll(HttpServletRequest request) {
        return service.getAll(sessions.requireUser(request));
    }

    @GetMapping("/assignments/{assignmentId}")
    public WorksheetAssignmentResponse getById(
            @PathVariable Long assignmentId, HttpServletRequest request) {
        return service.getById(assignmentId, sessions.requireUser(request));
    }

    @PostMapping("/assignments/{assignmentId}/results")
    @ResponseStatus(HttpStatus.CREATED)
    public WorksheetResultResponse createResult(
            @PathVariable Long assignmentId,
            @RequestBody CreateWorksheetResultRequest body,
            HttpServletRequest request) {
        return service.createResult(
                assignmentId, sessions.requireRole(request, UserRole.USER), body);
    }

    @GetMapping("/assignments/{assignmentId}/results")
    public List<WorksheetResultResponse> getResults(
            @PathVariable Long assignmentId, HttpServletRequest request) {
        return service.getResults(assignmentId, sessions.requireUser(request));
    }
}
