package com.worksheet.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository users;
    private final com.worksheet.space.SpaceTeamService team;
    private final AuthService auth;
    private final AuthSessionService sessions;

    public AuthController(AuthService auth, AuthSessionService sessions,com.worksheet.space.SpaceTeamService team,UserRepository users) {
        this.team=team; this.users=users;
        this.auth = auth;
        this.sessions = sessions;
    }

    @PostMapping(value = "/signup", consumes = "application/json")
    @ResponseStatus(CREATED)
    @org.springframework.transaction.annotation.Transactional
    public UserResponse signup(@RequestBody Signup input, HttpServletRequest request) {
        UserResponse user = auth.signup(input.name(), input.email(), input.password(), input.role());
        sessions.startSession(request, user);
        if(input.invitationToken()!=null) request.getSession().setAttribute("auth.spaceId",team.accept(input.invitationToken(),users.findById(user.id()).orElseThrow(com.worksheet.space.SpaceAccess::missing)));
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

    public record Signup(String name, String email, String password, UserRole role,String invitationToken) {}
    public record Login(String email, String password) {}
    public record CsrfResponse(String headerName, String parameterName, String token) {}
}
