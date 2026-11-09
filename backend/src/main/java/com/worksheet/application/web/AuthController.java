package com.worksheet.application.web;

import static org.springframework.http.HttpStatus.*;

import com.worksheet.auth.*;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final com.worksheet.application.SignupWorkflow signup;
    private final AuthService auth;
    private final AuthSessionService sessions;

    public AuthController(
            AuthService auth,
            AuthSessionService sessions,
            com.worksheet.application.SignupWorkflow signup) {
        this.auth = auth;
        this.sessions = sessions;
        this.signup = signup;
    }

    @PostMapping(value = "/signup", consumes = "application/json")
    @ResponseStatus(CREATED)
    public UserResponse signup(@RequestBody Signup input, HttpServletRequest request) {
        var created =
                signup.signup(
                        input.name(),
                        input.email(),
                        input.password(),
                        input.role(),
                        input.invitationToken());
        var user = created.user();
        var invitedSpace = created.spaceId();
        sessions.startSession(request, user);
        if (invitedSpace != null) request.getSession().setAttribute("auth.spaceId", invitedSpace);
        return user;
    }

    @PostMapping(value = "/login", consumes = "application/json")
    public UserResponse login(@RequestBody Login input, HttpServletRequest request) {
        UserResponse user = auth.login(input.email(), input.password());
        sessions.startSession(request, user);
        return user;
    }

    @GetMapping("/me")
    public UserResponse me(HttpServletRequest request) {
        return auth.currentUser(sessions.requireUserId(request));
    }

    @PostMapping("/logout")
    @ResponseStatus(NO_CONTENT)
    public void logout(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        var session = request.getSession(false);
        if (session != null) session.invalidate();
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getHeaderName(), token.getParameterName(), token.getToken());
    }

    public record Signup(
            String name, String email, String password, UserRole role, String invitationToken) {}

    public record Login(String email, String password) {}

    public record CsrfResponse(String headerName, String parameterName, String token) {}
}
