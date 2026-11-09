package com.worksheet.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.crypto.password.Pbkdf2PasswordEncoder.SecretKeyFactoryAlgorithm.PBKDF2WithHmacSHA256;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.Pbkdf2PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
        properties = {
            "spring.datasource.url=${auth.test.database-url:jdbc:h2:mem:auth-test;DB_CLOSE_DELAY=-1}",
            "spring.flyway.enabled=false",
            "spring.jpa.hibernate.ddl-auto=create-drop",
            "app.security.csrf-enabled=true"
        })
@AutoConfigureMockMvc
class AuthTests {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;

    private static final String DETAILS =
            """
            {"name":" Teacher ","email":"Teacher@Example.com","password":"a long test password"}
            """;

    @BeforeEach
    void clearUsers() {
        users.deleteAll();
    }

    @Test
    void signupStoresHashAndReturnsOnlyPublicFields() throws Exception {
        mvc.perform(
                        post("/api/auth/signup")
                                .with(
                                        org.springframework.security.test.web.servlet.request
                                                .SecurityMockMvcRequestPostProcessors.csrf())
                                .header("X-Auth-Request", "1")
                                .contentType("application/json")
                                .content(DETAILS))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("Teacher"))
                .andExpect(jsonPath("$.email").value("teacher@example.com"))
                .andExpect(jsonPath("$.createdAt").exists())
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(header().string("Cache-Control", "no-store"));
        User stored = users.findByEmail("teacher@example.com").orElseThrow();
        var encoder = new Pbkdf2PasswordEncoder("", 16, 600_000, PBKDF2WithHmacSHA256);
        assertNotEquals("a long test password", stored.getPasswordHash());
        assertTrue(encoder.matches("a long test password", stored.getPasswordHash()));
        assertNotEquals(encoder.encode("a long test password"), stored.getPasswordHash());
    }

    @Test
    void sessionChangesOnLoginAndEndsOnLogout() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        var original = new MockHttpSession();
        String originalId = original.getId();
        var signup =
                mvc.perform(
                                post("/api/auth/signup")
                                        .with(
                                                org.springframework.security.test.web.servlet
                                                        .request
                                                        .SecurityMockMvcRequestPostProcessors
                                                        .csrf())
                                        .session(original)
                                        .header("X-Auth-Request", "1")
                                        .contentType("application/json")
                                        .content(DETAILS))
                        .andExpect(status().isCreated())
                        .andReturn();
        var session = (MockHttpSession) signup.getRequest().getSession(false);
        assertNotEquals(originalId, session.getId());
        assertEquals(1800, session.getMaxInactiveInterval());
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk());
        mvc.perform(
                        post("/api/auth/logout")
                                .with(
                                        org.springframework.security.test.web.servlet.request
                                                .SecurityMockMvcRequestPostProcessors.csrf())
                                .session(session)
                                .header("X-Auth-Request", "1"))
                .andExpect(status().isNoContent());
        assertTrue(session.isInvalid());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        var login =
                mvc.perform(
                                post("/api/auth/login")
                                        .with(
                                                org.springframework.security.test.web.servlet
                                                        .request
                                                        .SecurityMockMvcRequestPostProcessors
                                                        .csrf())
                                        .header("X-Auth-Request", "1")
                                        .contentType("application/json")
                                        .content(DETAILS))
                        .andExpect(status().isOk())
                        .andReturn();
        mvc.perform(
                        get("/api/auth/me")
                                .session((MockHttpSession) login.getRequest().getSession(false)))
                .andExpect(status().isOk());
    }

    @Test
    void rejectsDuplicateEmailAndIncorrectCredentials() throws Exception {
        mvc.perform(
                        post("/api/auth/signup")
                                .with(
                                        org.springframework.security.test.web.servlet.request
                                                .SecurityMockMvcRequestPostProcessors.csrf())
                                .header("X-Auth-Request", "1")
                                .contentType("application/json")
                                .content(DETAILS))
                .andExpect(status().isCreated());
        mvc.perform(
                        post("/api/auth/signup")
                                .with(
                                        org.springframework.security.test.web.servlet.request
                                                .SecurityMockMvcRequestPostProcessors.csrf())
                                .header("X-Auth-Request", "1")
                                .contentType("application/json")
                                .content(
                                        DETAILS.replace(
                                                "Teacher@Example.com", " teacher@example.com ")))
                .andExpect(status().isConflict());
        for (String input :
                new String[] {
                    DETAILS.replace("a long test password", "an incorrect password"),
                    DETAILS.replace("Teacher@Example.com", "unknown@example.com")
                }) {
            var result =
                    mvc.perform(
                                    post("/api/auth/login")
                                            .with(
                                                    org.springframework.security.test.web.servlet
                                                            .request
                                                            .SecurityMockMvcRequestPostProcessors
                                                            .csrf())
                                            .header("X-Auth-Request", "1")
                                            .contentType("application/json")
                                            .content(input))
                            .andExpect(status().isUnauthorized())
                            .andExpect(
                                    jsonPath("$.message").value("Email or password is incorrect."))
                            .andReturn();
            assertNull(result.getRequest().getSession(false));
        }
        assertEquals(1, users.count());
    }

    @Test
    void validatesRequiredFieldsAndLimits() throws Exception {
        for (String input :
                new String[] {
                    "{}",
                    DETAILS.replace(" Teacher ", " "),
                    DETAILS.replace("Teacher@Example.com", "invalid"),
                    DETAILS.replace("a long test password", "short"),
                    DETAILS.replace("a long test password", "x".repeat(129)),
                    DETAILS.replace(" Teacher ", "x".repeat(101))
                }) {
            mvc.perform(
                            post("/api/auth/signup")
                                    .with(
                                            org.springframework.security.test.web.servlet.request
                                                    .SecurityMockMvcRequestPostProcessors.csrf())
                                    .header("X-Auth-Request", "1")
                                    .contentType("application/json")
                                    .content(input))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0, users.count());
    }

    @Test
    void rejectsCrossOriginAndMissingCsrfHeader() throws Exception {
        for (String endpoint : new String[] {"signup", "login", "logout"}) {
            mvc.perform(
                            post("/api/auth/" + endpoint)
                                    .contentType("application/json")
                                    .content(DETAILS))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(
                        options("/api/auth/signup")
                                .header("Origin", "https://untrusted.example")
                                .header("Access-Control-Request-Method", "POST")
                                .header("Access-Control-Request-Headers", "X-Auth-Request"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
        mvc.perform(
                        post("/api/auth/signup")
                                .with(
                                        org.springframework.security.test.web.servlet.request
                                                .SecurityMockMvcRequestPostProcessors.csrf())
                                .header("Origin", "https://untrusted.example")
                                .header("X-Auth-Request", "1")
                                .contentType("application/json")
                                .content(DETAILS))
                .andExpect(status().isForbidden());
        assertEquals(0, users.count());
    }

    @Test
    void allowsConfiguredFrontendOriginWithoutChangingMinigameAccess() throws Exception {
        mvc.perform(
                        options("/api/auth/signup")
                                .header("Origin", "http://localhost:5173")
                                .header("Access-Control-Request-Method", "POST")
                                .header(
                                        "Access-Control-Request-Headers",
                                        "Content-Type,X-Auth-Request"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
        mvc.perform(get("/api/minigame1")).andExpect(status().isOk());
    }
}
