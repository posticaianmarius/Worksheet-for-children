package com.worksheet.teaching.space;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import com.worksheet.auth.*;
import com.worksheet.content.catalog.*;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.*;

import tools.jackson.databind.node.JsonNodeFactory;

import java.time.Instant;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:teaching-spaces;DB_CLOSE_DELAY=-1",
            "spring.flyway.enabled=false",
            "spring.jpa.hibernate.ddl-auto=create-drop"
        })
@AutoConfigureMockMvc
class TeachingSpaceTests {
    @Autowired MockMvc mvc;
    @Autowired MiniGameDefinitionRepository games;
    @Autowired SpaceInvitationRepository invitations;
    @Autowired StudentCredentialRepository credentials;
    int counter;

    record Account(MockHttpSession session, long id) {}

    Account signup(String name) throws Exception {
        var result =
                mvc.perform(
                                post("/api/auth/signup")
                                        .header("X-Auth-Request", "1")
                                        .contentType("application/json")
                                        .content(
                                                "{\"name\":\""
                                                        + name
                                                        + "\",\"email\":\""
                                                        + java.util.UUID.randomUUID()
                                                        + "@test.example\",\"password\":\"a long"
                                                        + " test password\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        return new Account(
                (MockHttpSession) result.getRequest().getSession(), number(result, "$.id"));
    }

    MvcResult postAs(Account a, String path, String body) throws Exception {
        return mvc.perform(
                        post(path).session(a.session).contentType("application/json").content(body))
                .andExpect(status().is2xxSuccessful())
                .andReturn();
    }

    long number(MvcResult result, String path) throws Exception {
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), path))
                .longValue();
    }

    String string(MvcResult result, String path) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), path);
    }

    long space(Account a) throws Exception {
        return number(
                mvc.perform(get("/api/auth/context").session(a.session))
                        .andExpect(status().isOk())
                        .andReturn(),
                "$.spaceId");
    }

    long classroom(Account a, String name) throws Exception {
        return number(postAs(a, "/api/classes", "{\"name\":\"" + name + "\"}"), "$.id");
    }

    long invite(Account owner, Account teacher, long space) throws Exception {
        var invitation = postAs(owner, "/api/spaces/" + space + "/invitations", "{}");
        postAs(
                teacher,
                "/api/spaces/invitations/accept",
                "{\"token\":\"" + string(invitation, "$.token") + "\"}");
        return number(invitation, "$.id");
    }

    @Test
    void sharedStudentLoginSurvivesMembershipRemovalAndRotationRevokesSessions() throws Exception {
        var owner = signup("Owner");
        long space = space(owner), a = classroom(owner, "Math"), b = classroom(owner, "Reading");
        var student = postAs(owner, "/api/classes/" + a + "/members", "{\"name\":\"Alex\"}");
        long profile = number(student, "$.studentId"), user = number(student, "$.userId");
        mvc.perform(get("/api/classes/" + a + "/members").session(owner.session))
                .andExpect(jsonPath("$[0].studentCode").isEmpty());
        postAs(owner, "/api/classes/" + b + "/members", "{\"studentId\":" + profile + "}");
        var card =
                postAs(
                        owner,
                        "/api/spaces/" + space + "/students/" + profile + "/credential",
                        "{}");
        String code = string(card, "$.code");
        var alias = new StudentCredential();
        alias.studentId = profile;
        alias.code = "ALIS2345";
        credentials.saveAndFlush(alias);
        var login =
                mvc.perform(
                                post("/api/play/login")
                                        .contentType("application/json")
                                        .content("{\"studentCode\":\"" + code + "\"}"))
                        .andExpect(status().isOk())
                        .andReturn();
        var child = (MockHttpSession) login.getRequest().getSession();
        mvc.perform(get("/api/classes").session(child)).andExpect(jsonPath("$", hasSize(2)));
        mvc.perform(delete("/api/classes/" + a + "/members/" + user).session(owner.session))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/classes").session(child)).andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(
                        post("/api/play/login")
                                .contentType("application/json")
                                .content("{\"studentCode\":\"" + code + "\"}"))
                .andExpect(status().isOk());
        postAs(owner, "/api/spaces/" + space + "/students/" + profile + "/credential/rotate", "{}");
        mvc.perform(get("/api/auth/me").session(child)).andExpect(status().isUnauthorized());
        mvc.perform(
                        post("/api/play/login")
                                .contentType("application/json")
                                .content("{\"studentCode\":\"" + code + "\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(
                        post("/api/play/login")
                                .contentType("application/json")
                                .content("{\"studentCode\":\"ALIS2345\"}"))
                .andExpect(status().isNotFound());
        postAs(owner, "/api/classes/" + a + "/members", "{\"studentId\":" + profile + "}");
        mvc.perform(get("/api/classes/" + a + "/members/" + user).session(owner.session))
                .andExpect(jsonPath("$.userId").value(user));
    }

    @Test
    void coTeachersUseSnapshotsWithoutDraftAccessAndNeedExplicitCredentialPermission()
            throws Exception {
        var owner = signup("Owner");
        var teacher = signup("Teacher");
        var outsider = signup("Outsider");
        long personal = space(teacher),
                space = space(owner),
                classroom = classroom(owner, "Shared");
        long personalClass = classroom(teacher, "Personal");
        invite(owner, teacher, space);
        postAs(owner, "/api/classes/" + classroom + "/teachers", "{\"userId\":" + teacher.id + "}");
        mvc.perform(get("/api/classes").session(teacher.session))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(classroom));
        mvc.perform(get("/api/classes/" + personalClass).session(teacher.session))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/classes").header("X-Space-Id", personal).session(teacher.session))
                .andExpect(jsonPath("$[0].id").value(personalClass));
        var child = postAs(owner, "/api/classes/" + classroom + "/members", "{\"name\":\"Maria\"}");
        long profile = number(child, "$.studentId");
        mvc.perform(
                        post("/api/spaces/" + space + "/students/" + profile + "/credential")
                                .session(teacher.session))
                .andExpect(status().isForbidden());
        mvc.perform(
                        patch("/api/spaces/" + space + "/members/" + teacher.id)
                                .session(owner.session)
                                .contentType("application/json")
                                .content("{\"manageStudentAccess\":true}"))
                .andExpect(status().isOk());
        postAs(teacher, "/api/spaces/" + space + "/students/" + profile + "/credential", "{}");
        long worksheet =
                number(postAs(owner, "/api/worksheets", "{\"name\":\"Private draft\"}"), "$.id");
        var game =
                games.save(
                        new MiniGameDefinition(
                                "Test",
                                "space-test-" + java.util.UUID.randomUUID(),
                                JsonNodeFactory.instance.objectNode(),
                                true));
        postAs(
                owner,
                "/api/worksheets/" + worksheet + "/items",
                "{\"miniGameId\":" + game.getId() + ",\"orderIndex\":1,\"configuration\":{}}");
        var delivery =
                postAs(
                        owner,
                        "/api/worksheets/" + worksheet + "/assignments",
                        "{\"classroomId\":" + classroom + ",\"title\":\"Monday\"}");
        long assignment = number(delivery, "$[0].id");
        String batch = string(delivery, "$[0].batchId");
        mvc.perform(get("/api/worksheets/" + worksheet).session(teacher.session))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/assignments/" + assignment).session(teacher.session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deliveryTitle").value("Monday"));
        mvc.perform(
                        get("/api/assignments/report?classroomId=" + classroom)
                                .session(teacher.session))
                .andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/assignments/" + assignment).session(outsider.session))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/assignments/batches/" + batch).session(teacher.session))
                .andExpect(status().isNoContent());
        mvc.perform(
                        delete("/api/spaces/" + space + "/members/" + teacher.id)
                                .session(owner.session))
                .andExpect(status().isOk());
        mvc.perform(get("/api/classes/" + classroom).session(teacher.session))
                .andExpect(status().isNotFound());
    }

    @Test
    void invitationsAreSingleUseRevocableAndExpireAndDuplicatesNeedConfirmation() throws Exception {
        var owner = signup("Owner");
        var teacher = signup("Teacher");
        long space = space(owner);
        var invite = postAs(owner, "/api/spaces/" + space + "/invitations", "{}");
        String token = string(invite, "$.token");
        postAs(teacher, "/api/spaces/invitations/accept", "{\"token\":\"" + token + "\"}");
        mvc.perform(
                        post("/api/spaces/invitations/accept")
                                .session(teacher.session)
                                .contentType("application/json")
                                .content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isNotFound());
        var expired = postAs(owner, "/api/spaces/" + space + "/invitations", "{}");
        var entity = invitations.findById(number(expired, "$.id")).orElseThrow();
        entity.expiresAt = Instant.now().minusSeconds(1);
        invitations.save(entity);
        mvc.perform(
                        post("/api/spaces/invitations/accept")
                                .session(teacher.session)
                                .contentType("application/json")
                                .content("{\"token\":\"" + string(expired, "$.token") + "\"}"))
                .andExpect(status().isNotFound());
        var revoked = postAs(owner, "/api/spaces/" + space + "/invitations", "{}");
        mvc.perform(
                        delete("/api/spaces/" + space + "/invitations/" + number(revoked, "$.id"))
                                .session(owner.session))
                .andExpect(status().isOk());
        mvc.perform(
                        post("/api/spaces/invitations/accept")
                                .session(teacher.session)
                                .contentType("application/json")
                                .content("{\"token\":\"" + string(revoked, "$.token") + "\"}"))
                .andExpect(status().isNotFound());
        postAs(owner, "/api/spaces/" + space + "/students", "{\"name\":\"Alex\"}");
        mvc.perform(
                        post("/api/spaces/" + space + "/students")
                                .session(owner.session)
                                .contentType("application/json")
                                .content("{\"name\":\"alex\"}"))
                .andExpect(status().isConflict());
        postAs(
                owner,
                "/api/spaces/" + space + "/students",
                "{\"name\":\"Alex\",\"allowDuplicate\":true}");
    }

    @Test
    void studentArchivalDisablesSessionsAndSpaceHeadersCannotChangeStudentIdentity()
            throws Exception {
        var owner = signup("Owner");
        var other = signup("Other");
        long space = space(owner), otherSpace = space(other), classroom = classroom(owner, "Class");
        var profile =
                postAs(owner, "/api/classes/" + classroom + "/members", "{\"name\":\"Alex\"}");
        long student = number(profile, "$.studentId");
        String code =
                string(
                        postAs(
                                owner,
                                "/api/spaces/" + space + "/students/" + student + "/credential",
                                "{}"),
                        "$.code");
        var login =
                mvc.perform(
                                post("/api/play/login")
                                        .contentType("application/json")
                                        .content("{\"studentCode\":\"" + code + "\"}"))
                        .andExpect(status().isOk())
                        .andReturn();
        var session = (MockHttpSession) login.getRequest().getSession();
        mvc.perform(get("/api/assignments").session(session).header("X-Space-Id", otherSpace))
                .andExpect(status().isNotFound());
        mvc.perform(
                        post("/api/auth/context")
                                .session(session)
                                .contentType("application/json")
                                .content("{\"spaceId\":" + otherSpace + "}"))
                .andExpect(status().isNotFound());
        mvc.perform(
                        patch("/api/spaces/" + space + "/students/" + student)
                                .session(owner.session)
                                .contentType("application/json")
                                .content("{\"archive\":true}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
        mvc.perform(
                        post("/api/play/login")
                                .contentType("application/json")
                                .content("{\"studentCode\":\"" + code + "\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void coTeacherAssignmentUsesReviewedRevisionAndOwnerCannotReadPrivateDraft() throws Exception {
        var owner = signup("Owner");
        var co = signup("Co teacher");
        long space = space(owner), classroom = classroom(owner, "Class");
        invite(owner, co, space);
        postAs(owner, "/api/classes/" + classroom + "/teachers", "{\"userId\":" + co.id + "}");
        postAs(owner, "/api/classes/" + classroom + "/members", "{\"name\":\"Alex\"}");
        long worksheet =
                number(postAs(co, "/api/worksheets", "{\"name\":\"Reviewed version\"}"), "$.id");
        var game =
                games.save(
                        new MiniGameDefinition(
                                "Test",
                                "frozen-" + java.util.UUID.randomUUID(),
                                JsonNodeFactory.instance.objectNode(),
                                true));
        postAs(
                co,
                "/api/worksheets/" + worksheet + "/items",
                "{\"miniGameId\":" + game.getId() + ",\"orderIndex\":1,\"configuration\":{}}");
        long revision =
                number(
                        postAs(co, "/api/worksheets/" + worksheet + "/assignments/preview", "{}"),
                        "$.revisionId");
        mvc.perform(
                        put("/api/worksheets/" + worksheet)
                                .session(co.session)
                                .contentType("application/json")
                                .content("{\"name\":\"Later draft\"}"))
                .andExpect(status().isOk());
        var result =
                postAs(
                        co,
                        "/api/worksheets/" + worksheet + "/assignments",
                        "{\"classroomId\":" + classroom + ",\"revisionId\":" + revision + "}");
        long assignment = number(result, "$[0].id");
        mvc.perform(get("/api/assignments/" + assignment).session(owner.session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.worksheet.name").value("Reviewed version"));
        mvc.perform(get("/api/worksheets/" + worksheet).session(owner.session))
                .andExpect(status().isNotFound());
    }

    @Test
    void newPageDeepLinksArePublicButTheirApisStillRequireAuthentication() throws Exception {
        for (String route :
                java.util.List.of(
                        "/space",
                        "/students",
                        "/invite",
                        "/work/00000000-0000-0000-0000-000000000001"))
            mvc.perform(get(route)).andExpect(status().isOk());
        mvc.perform(get("/api/spaces")).andExpect(status().isUnauthorized());
    }
}
