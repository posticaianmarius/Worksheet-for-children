package com.worksheet.learning.access;

import com.worksheet.auth.AuthSessionService;
import com.worksheet.teaching.classroom.*;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/play")
public class StudentPlayController {
    private final StudentPlayService play;
    private final AuthSessionService sessions;
    private final StudentSignInLimiter limiter;

    public StudentPlayController(
            StudentPlayService play, AuthSessionService sessions, StudentSignInLimiter limiter) {
        this.play = play;
        this.sessions = sessions;
        this.limiter = limiter;
    }

    @PostMapping("/join")
    public StudentPlayService.StudentEntry join(
            @RequestBody JoinRequest body, HttpServletRequest request) {
        var entry = attempt(request, () -> play.join(body.studentCode(), body.worksheetCode()));
        // Authenticate only after both codes have been validated and the assignment committed.
        sessions.startCodeSession(request, entry.user(), body.studentCode());
        return entry;
    }

    @PostMapping("/login")
    public com.worksheet.auth.UserResponse login(
            @RequestBody LoginRequest body, HttpServletRequest request) {
        var user = attempt(request, () -> play.login(body.studentCode()));
        sessions.startCodeSession(request, user, body.studentCode());
        return user;
    }

    private <T> T attempt(HttpServletRequest request, java.util.function.Supplier<T> action) {
        limiter.check(request.getRemoteAddr());
        try {
            return action.get();
        } catch (org.springframework.web.server.ResponseStatusException error) {
            if (error.getStatusCode().value() == 404 || error.getStatusCode().value() == 400)
                limiter.failed(request.getRemoteAddr());
            throw error;
        }
    }

    public record LoginRequest(String studentCode) {}

    public record JoinRequest(String studentCode, String worksheetCode) {}
}
