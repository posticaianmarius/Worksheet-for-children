package com.worksheet.application;

import com.worksheet.auth.AuthService;
import com.worksheet.auth.UserResponse;
import com.worksheet.auth.UserRole;
import com.worksheet.auth.api.UserAccounts;
import com.worksheet.teaching.space.SpaceAccess;
import com.worksheet.teaching.space.SpaceTeamService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SignupWorkflow {
    private final AuthService auth;
    private final UserAccounts users;
    private final SpaceTeamService team;

    public SignupWorkflow(AuthService auth, UserAccounts users, SpaceTeamService team) {
        this.auth = auth;
        this.users = users;
        this.team = team;
    }

    public record Created(UserResponse user, Long spaceId) {}

    @Transactional
    public Created signup(String name, String email, String password, UserRole role, String token) {
        var user = auth.signup(name, email, password, role);
        Long spaceId =
                token == null
                        ? null
                        : team.accept(
                                token, users.findById(user.id()).orElseThrow(SpaceAccess::missing));
        return new Created(user, spaceId);
    }
}
