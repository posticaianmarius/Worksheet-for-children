package com.worksheet.content.catalog;

import com.worksheet.auth.AuthSessionService;
import com.worksheet.auth.User;
import com.worksheet.auth.UserRole;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/minigames")
public class MiniGameDefinitionController {
    private final MiniGameDefinitionService service;
    private final AuthSessionService auth;

    public MiniGameDefinitionController(
            MiniGameDefinitionService service, AuthSessionService auth) {
        this.service = service;
        this.auth = auth;
    }

    @GetMapping
    public List<MiniGameDefinitionResponse> getAll() {
        return service.getActive();
    }

    @GetMapping("/{id}")
    public MiniGameDefinitionResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MiniGameDefinitionResponse create(
            @RequestBody CreateMiniGameDefinitionRequest body, HttpServletRequest request) {
        User admin = auth.requireRole(request, UserRole.ADMIN);
        return service.create(admin, body);
    }

    @PutMapping("/{id}")
    public MiniGameDefinitionResponse update(
            @PathVariable Long id,
            @RequestBody UpdateMiniGameDefinitionRequest body,
            HttpServletRequest request) {
        auth.requireRole(request, UserRole.ADMIN);
        return service.update(id, body);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable Long id, HttpServletRequest request) {
        auth.requireRole(request, UserRole.ADMIN);
        service.deactivate(id);
    }
}
