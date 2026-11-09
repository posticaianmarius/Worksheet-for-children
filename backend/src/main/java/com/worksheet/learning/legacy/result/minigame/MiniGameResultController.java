package com.worksheet.learning.legacy.result.minigame;

import com.worksheet.auth.AuthSessionService;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/worksheet-results/{worksheetResultId}/mini-game-results")
public class MiniGameResultController {
    private final MiniGameResultService service;
    private final AuthSessionService authSessionService;

    public MiniGameResultController(
            MiniGameResultService service, AuthSessionService authSessionService) {
        this.service = service;
        this.authSessionService = authSessionService;
    }

    @GetMapping
    public List<MiniGameResultResponse> getAll(
            @PathVariable Long worksheetResultId, HttpServletRequest request) {
        return service.getAll(worksheetResultId, authSessionService.requireUserId(request));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MiniGameResultResponse create(
            @PathVariable Long worksheetResultId,
            @RequestBody CreateMiniGameResultRequest body,
            HttpServletRequest request) {
        return service.create(worksheetResultId, authSessionService.requireUserId(request), body);
    }

    @PutMapping("/{miniGameResultId}")
    public MiniGameResultResponse update(
            @PathVariable Long worksheetResultId,
            @PathVariable Long miniGameResultId,
            @RequestBody CreateMiniGameResultRequest body,
            HttpServletRequest request) {
        return service.update(
                worksheetResultId,
                miniGameResultId,
                authSessionService.requireUserId(request),
                body);
    }

    @DeleteMapping("/{miniGameResultId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable Long worksheetResultId,
            @PathVariable Long miniGameResultId,
            HttpServletRequest request) {
        service.delete(
                worksheetResultId, miniGameResultId, authSessionService.requireUserId(request));
    }
}
