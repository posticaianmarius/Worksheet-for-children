package com.worksheet.auth;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {
    private final UserRepository users;

    public AdminUserController(UserRepository users) {
        this.users = users;
    }

    @GetMapping
    public List<UserResponse> getAll() {
        return users.findAll().stream().map(UserResponse::from).toList();
    }

    @PatchMapping("/{id}/role")
    public UserResponse changeRole(@PathVariable Long id, @RequestBody ChangeRoleRequest request) {
        if (request.role() == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role is required.");
        User user =
                users.findById(id)
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND, "User not found."));
        if (user.getRole() == UserRole.ADMIN
                && request.role() != UserRole.ADMIN
                && users.countByRole(UserRole.ADMIN) <= 1) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "The last administrator cannot be demoted.");
        }
        user.changeRole(request.role());
        return UserResponse.from(users.save(user));
    }

    public record ChangeRoleRequest(UserRole role) {}
}
