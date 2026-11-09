package com.worksheet.auth.api;

import com.worksheet.auth.User;
import com.worksheet.auth.UserRepository;
import com.worksheet.auth.UserRole;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

/** Account persistence stays in auth; domain modules use identity operations. */
@Service
public class UserAccounts {
    private final UserRepository users;

    public UserAccounts(UserRepository users) {
        this.users = users;
    }

    @Transactional(readOnly = true)
    public Optional<User> findById(Long id) {
        return users.findById(id);
    }

    @Transactional
    public User createManagedStudent(String name) {
        return users.saveAndFlush(
                new User(name, UUID.randomUUID() + "@student.invalid", "!", UserRole.USER));
    }
}
