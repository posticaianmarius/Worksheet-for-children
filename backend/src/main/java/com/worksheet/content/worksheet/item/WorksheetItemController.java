package com.worksheet.content.worksheet.item;

import com.worksheet.auth.AuthSessionService;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/worksheets/{worksheetId}/items")
public class WorksheetItemController {
    private final WorksheetItemService service;
    private final AuthSessionService authSessionService;

    public WorksheetItemController(
            WorksheetItemService service, AuthSessionService authSessionService) {
        this.service = service;
        this.authSessionService = authSessionService;
    }

    @GetMapping
    public List<WorksheetItemResponse> getAll(
            @PathVariable Long worksheetId, HttpServletRequest request) {
        return service.getAll(worksheetId, authSessionService.requireUserId(request));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorksheetItemResponse create(
            @PathVariable Long worksheetId,
            @RequestBody CreateWorksheetItemRequest body,
            HttpServletRequest request) {
        return service.create(
                worksheetId, authSessionService.requireWorksheetEditor(request).getId(), body);
    }

    @PutMapping("/{itemId}")
    public WorksheetItemResponse update(
            @PathVariable Long worksheetId,
            @PathVariable Long itemId,
            @RequestBody CreateWorksheetItemRequest body,
            HttpServletRequest request) {
        return service.update(
                worksheetId,
                itemId,
                authSessionService.requireWorksheetEditor(request).getId(),
                body);
    }

    @DeleteMapping("/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable Long worksheetId, @PathVariable Long itemId, HttpServletRequest request) {
        service.delete(
                worksheetId, itemId, authSessionService.requireWorksheetEditor(request).getId());
    }
}
