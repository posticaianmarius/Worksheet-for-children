package com.worksheet.learning.legacy.result;

import com.worksheet.auth.AuthSessionService;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/worksheets/{worksheetId}/results")
public class WorksheetResultController {
    private final WorksheetResultService service;
    private final AuthSessionService authSessionService;

    public WorksheetResultController(
            WorksheetResultService service, AuthSessionService authSessionService) {
        this.service = service;
        this.authSessionService = authSessionService;
    }

    @GetMapping
    public List<WorksheetResultResponse> getAll(
            @PathVariable Long worksheetId, HttpServletRequest request) {
        return service.getAll(worksheetId, authSessionService.requireUserId(request));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorksheetResultResponse create(
            @PathVariable Long worksheetId,
            @RequestBody CreateWorksheetResultRequest body,
            HttpServletRequest request) {
        return service.create(worksheetId, authSessionService.requireUserId(request), body);
    }

    @PutMapping("/{resultId}")
    public WorksheetResultResponse update(
            @PathVariable Long worksheetId,
            @PathVariable Long resultId,
            @RequestBody CreateWorksheetResultRequest body,
            HttpServletRequest request) {
        return service.update(
                worksheetId, resultId, authSessionService.requireUserId(request), body);
    }

    @DeleteMapping("/{resultId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable Long worksheetId,
            @PathVariable Long resultId,
            HttpServletRequest request) {
        service.delete(worksheetId, resultId, authSessionService.requireUserId(request));
    }
}
