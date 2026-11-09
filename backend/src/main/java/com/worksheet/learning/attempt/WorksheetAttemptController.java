package com.worksheet.learning.attempt;

import com.worksheet.auth.AuthSessionService;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class WorksheetAttemptController {
    private final WorksheetAttemptService service;
    private final AuthSessionService sessions;

    public WorksheetAttemptController(
            WorksheetAttemptService service, AuthSessionService sessions) {
        this.service = service;
        this.sessions = sessions;
    }

    @PostMapping("/worksheets/{worksheetId}/attempts")
    @ResponseStatus(HttpStatus.CREATED)
    public WorksheetAttemptResponse startPersonal(
            @PathVariable Long worksheetId, HttpServletRequest request) {
        return service.startPersonal(worksheetId, sessions.requireUser(request));
    }

    @GetMapping("/worksheets/{worksheetId}/attempts")
    public List<WorksheetAttemptResponse> personalAttempts(
            @PathVariable Long worksheetId, HttpServletRequest request) {
        return service.getPersonal(worksheetId, sessions.requireUser(request));
    }

    @PostMapping("/assignments/{assignmentId}/attempts")
    @ResponseStatus(HttpStatus.CREATED)
    public WorksheetAttemptResponse startAssigned(
            @PathVariable Long assignmentId, HttpServletRequest request) {
        return service.startAssigned(assignmentId, sessions.requireUser(request));
    }

    @GetMapping("/assignments/{assignmentId}/attempts")
    public List<WorksheetAttemptResponse> assignedAttempts(
            @PathVariable Long assignmentId, HttpServletRequest request) {
        return service.getAssigned(assignmentId, sessions.requireUser(request));
    }

    @GetMapping("/attempts/{attemptId}")
    public WorksheetAttemptResponse get(@PathVariable Long attemptId, HttpServletRequest request) {
        return service.get(attemptId, sessions.requireUser(request));
    }

    @PutMapping("/attempts/{attemptId}/items/{revisionItemId}/result")
    public AttemptItemResultResponse saveResult(
            @PathVariable Long attemptId,
            @PathVariable Long revisionItemId,
            @RequestBody SaveAttemptItemResultRequest body,
            HttpServletRequest request) {
        return service.saveResult(attemptId, revisionItemId, sessions.requireUser(request), body);
    }

    @PostMapping("/attempts/{attemptId}/complete")
    public WorksheetAttemptResponse complete(
            @PathVariable Long attemptId, HttpServletRequest request) {
        return service.complete(attemptId, sessions.requireUser(request));
    }
}
