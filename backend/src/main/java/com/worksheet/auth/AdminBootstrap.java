package com.worksheet.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AdminBootstrap implements ApplicationRunner {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final String name;
    private final String email;
    private final String password;

    public AdminBootstrap(
            UserRepository users,
            PasswordEncoder passwords,
            @Value("${app.bootstrap-admin.name:}") String name,
            @Value("${app.bootstrap-admin.email:}") String email,
            @Value("${app.bootstrap-admin.password:}") String password) {
        this.users = users;
        this.passwords = passwords;
        this.name = name == null ? "" : name.strip();
        this.email = email == null ? "" : email.strip().toLowerCase(java.util.Locale.ROOT);
        this.password = password == null ? "" : password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        boolean anyConfigured = !name.isEmpty() || !email.isEmpty() || !password.isEmpty();
        if (!anyConfigured) return;
        if (name.isEmpty()
                || email.isEmpty()
                || password.length() < 15
                || password.length() > 128) {
            throw new IllegalStateException(
                    "Bootstrap admin requires name, email, and a 15-128 character password.");
        }
        User existing = users.findByEmail(email).orElse(null);
        if (existing != null) {
            if (existing.getRole() != UserRole.ADMIN) {
                throw new IllegalStateException(
                        "Bootstrap admin email belongs to a non-admin account; refusing silent"
                            + " promotion.");
            }
            return;
        }
        users.save(new User(name, email, passwords.encode(password), UserRole.ADMIN));
    }
}
