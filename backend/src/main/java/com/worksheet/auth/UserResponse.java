package com.worksheet.auth;

import java.time.Instant;

public record UserResponse(Long id, String name, String email, UserRole role, Instant createdAt) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                "!".equals(user.getPasswordHash()) ? null : user.getEmail(),
                user.getRole(),
                user.getCreatedAt());
    }
}
