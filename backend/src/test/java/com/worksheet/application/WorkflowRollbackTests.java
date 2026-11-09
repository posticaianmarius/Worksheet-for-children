package com.worksheet.application;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.worksheet.auth.UserRepository;
import com.worksheet.learning.api.LearningLifecycle;
import com.worksheet.teaching.classroom.ClassroomMemberRepository;
import com.worksheet.teaching.classroom.ClassroomRepository;

import jakarta.servlet.ServletException;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** No test transaction: these assertions observe committed/rolled-back HTTP work. */
@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:workflow-rollback;DB_CLOSE_DELAY=-1",
            "spring.flyway.enabled=false",
            "spring.jpa.hibernate.ddl-auto=create-drop"
        })
@AutoConfigureMockMvc
class WorkflowRollbackTests {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired ClassroomRepository classrooms;
    @Autowired ClassroomMemberRepository members;
    @MockitoBean LearningLifecycle learning;

    @Test
    void invalidInvitationRollsBackAccountCreation() throws Exception {
        mvc.perform(
                        post("/api/auth/signup")
                                .header("X-Auth-Request", "1")
                                .contentType("application/json")
                                .content(
                                        "{\"name\":\"Invited\",\"email\":\"invalid-invite@example.test\",\"password\":\"A-strong-test-password-2026\",\"invitationToken\":\"missing-token\"}"))
                .andExpect(status().isNotFound());
        assertFalse(users.existsByEmail("invalid-invite@example.test"));
    }

    @Test
    void learningFailureRollsBackClassArchiveAndRosterRemoval() throws Exception {
        var signup =
                mvc.perform(
                                post("/api/auth/signup")
                                        .header("X-Auth-Request", "1")
                                        .contentType("application/json")
                                        .content(
                                                "{\"name\":\"Owner\",\"email\":\"rollback-owner@example.test\",\"password\":\"A-strong-test-password-2026\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        var session = (MockHttpSession) signup.getRequest().getSession();
        var created =
                mvc.perform(
                                post("/api/classes")
                                        .session(session)
                                        .contentType("application/json")
                                        .content("{\"name\":\"Preserved class\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        Long id =
                ((Number) JsonPath.read(created.getResponse().getContentAsString(), "$.id"))
                        .longValue();
        mvc.perform(
                        post("/api/classes/{id}/members", id)
                                .session(session)
                                .contentType("application/json")
                                .content("{\"name\":\"Child\"}"))
                .andExpect(status().isCreated());
        doThrow(new IllegalStateException("simulated learning failure"))
                .when(learning)
                .archiveClass(id);
        assertThrows(
                ServletException.class,
                () -> mvc.perform(delete("/api/classes/{id}", id).session(session)));
        assertNull(classrooms.findById(id).orElseThrow().getArchivedAt());
        assertEquals(1, members.countByClassroom_IdAndLeftAtIsNull(id));
    }
}
