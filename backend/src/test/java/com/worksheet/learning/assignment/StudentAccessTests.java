package com.worksheet.learning.assignment;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MvcResult;

class StudentAccessTests extends TeacherScenarioSupport {
    @Test
    void supportsRolesAndEnforcesTeacherOnlyActions() throws Exception {
        Account defaultTeacher = signup("Default Teacher", "default.teacher@example.com", null);
        Account teacher = signup("Teacher", "teacher.roles@example.com", "TEACHER");
        Account student = signup("Student", "student.roles@example.com", "USER");

        mvc.perform(get("/api/auth/me").session(defaultTeacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("TEACHER"));
        mvc.perform(get("/api/auth/me").session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("TEACHER"));
        mvc.perform(get("/api/auth/me").session(student.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("USER"));
        mvc.perform(
                        post("/api/classes")
                                .session(student.session())
                                .contentType("application/json")
                                .content("{\"name\":\"Forbidden\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(
                        post("/api/classes/join")
                                .session(teacher.session())
                                .contentType("application/json")
                                .content("{\"joinCode\":\"UNKNOWN\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(
                        post("/api/auth/signup")
                                .header("X-Auth-Request", "1")
                                .contentType("application/json")
                                .content(
                                        "{\"name\":\"Bad\",\"email\":\"bad.role@example.com\",\"password\":\"a"
                                            + " long test password\",\"role\":\"ADMIN\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void joinsClassesByRotatableCodeAndProtectsTeacherBoundaries() throws Exception {
        Account teacher = signup("Teacher", "teacher.classes@example.com", "TEACHER");
        Account otherTeacher = signup("Other Teacher", "other.teacher@example.com", "TEACHER");
        Account user = signup("Student", "student.classes@example.com", "USER");
        MvcResult created = createClassroom(teacher, "Class A");
        Long classroomId = idFrom(created);
        String oldCode = JsonPath.read(body(created), "$.joinCode");

        mvc.perform(
                        post("/api/classes/join")
                                .session(user.session())
                                .contentType("application/json")
                                .content("{\"joinCode\":\"" + oldCode.toLowerCase() + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.joinCode").value((Object) null));
        mvc.perform(
                        post("/api/classes/join")
                                .session(user.session())
                                .contentType("application/json")
                                .content("{\"joinCode\":\"" + oldCode + "\"}"))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/classes/{id}/members", classroomId).session(otherTeacher.session()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/classes/{id}", classroomId).session(otherTeacher.session()))
                .andExpect(status().isNotFound());

        MvcResult rotated =
                mvc.perform(
                                post("/api/classes/{id}/join-code/rotate", classroomId)
                                        .session(teacher.session()))
                        .andExpect(status().isOk())
                        .andReturn();
        String newCode = JsonPath.read(body(rotated), "$.joinCode");
        Account secondUser = signup("Second", "second.classes@example.com", "USER");
        mvc.perform(
                        post("/api/classes/join")
                                .session(secondUser.session())
                                .contentType("application/json")
                                .content("{\"joinCode\":\"" + oldCode + "\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(
                        post("/api/classes/join")
                                .session(secondUser.session())
                                .contentType("application/json")
                                .content("{\"joinCode\":\"" + newCode + "\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void childrenPlayByCodesAndKeepClassResultsWithoutSigningUp() throws Exception {
        Account teacher = signup("Teacher", "teacher.codes@example.com", "TEACHER");
        Long classroomId = idFrom(createClassroom(teacher, "Code class"));
        MvcResult child =
                mvc.perform(
                                post("/api/classes/{id}/members", classroomId)
                                        .session(teacher.session())
                                        .contentType("application/json")
                                        .content("{\"name\":\"Ana\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.name").value("Ana"))
                        .andExpect(jsonPath("$.email").value((Object) null))
                        .andReturn();
        Long childId = ((Number) JsonPath.read(body(child), "$.userId")).longValue();
        String childCode = codeFromChild(teacher, child);
        Long worksheetId = createWorksheet(teacher, "Code worksheet");
        createItem(teacher, worksheetId);
        MvcResult started =
                mvc.perform(
                                post("/api/classes/{id}/tests", classroomId)
                                        .session(teacher.session())
                                        .contentType("application/json")
                                        .content("{\"worksheetId\":" + worksheetId + "}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String worksheetCode = JsonPath.read(body(started), "$.code");

        MvcResult joined =
                mvc.perform(
                                post("/api/play/join")
                                        .contentType("application/json")
                                        .content(
                                                entryBody(
                                                        " " + childCode.toLowerCase() + " ",
                                                        " " + worksheetCode.toLowerCase() + " ")))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.user.id").value(childId))
                        .andExpect(jsonPath("$.user.email").value((Object) null))
                        .andReturn();
        MockHttpSession childSession = (MockHttpSession) joined.getRequest().getSession(false);
        Long assignmentId = ((Number) JsonPath.read(body(joined), "$.assignmentId")).longValue();
        mvc.perform(get("/api/auth/me").session(childSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(childId))
                .andExpect(jsonPath("$.email").value((Object) null));
        mvc.perform(
                        post("/api/classes/join")
                                .session(childSession)
                                .contentType("application/json")
                                .content(
                                        "{\"joinCode\":\""
                                                + classrooms
                                                        .findById(classroomId)
                                                        .orElseThrow()
                                                        .getJoinCode()
                                                + "\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/assignments").session(childSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].classroomId").value(classroomId));
        MvcResult attempt =
                mvc.perform(
                                post("/api/assignments/{id}/attempts", assignmentId)
                                        .session(childSession))
                        .andExpect(status().isCreated())
                        .andReturn();
        Long attemptId = idFrom(attempt);
        Long revisionItemId = ((Number) JsonPath.read(body(attempt), "$.items[0].id")).longValue();
        mvc.perform(
                        put("/api/attempts/{id}/items/{item}/result", attemptId, revisionItemId)
                                .session(childSession)
                                .contentType("application/json")
                                .content(
                                        "{\"outcome\":\"COMPLETED\",\"score\":3,\"maxScore\":5,\"timeSeconds\":10,\"details\":{}}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/attempts/{id}/complete", attemptId).session(childSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalScore").value(3));
        mvc.perform(get("/api/classes/{id}/members", classroomId).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].studentCode").isEmpty())
                .andExpect(jsonPath("$[0].averagePercent").isEmpty())
                .andExpect(jsonPath("$[0].worstTest").isEmpty());
        mvc.perform(
                        get("/api/classes/{id}/members/{user}/tests", classroomId, childId)
                                .session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].attemptId").value(attemptId));
        mvc.perform(
                        patch("/api/classes/{id}/members/{user}", classroomId, childId)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content("{\"name\":\"Ana Maria\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentCode").isEmpty());
        mvc.perform(
                        post("/api/play/join")
                                .contentType("application/json")
                                .content(entryBody(childCode, worksheetCode)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.name").value("Ana Maria"))
                .andExpect(jsonPath("$.assignmentId").value(assignmentId));

        mvc.perform(
                        delete("/api/classes/{id}/members/{user}", classroomId, childId)
                                .session(teacher.session()))
                .andExpect(status().isNoContent());
        mvc.perform(
                        post("/api/play/join")
                                .contentType("application/json")
                                .content(entryBody(childCode, worksheetCode)))
                .andExpect(status().isNotFound());
        mvc.perform(
                        post("/api/worksheets/join")
                                .session(childSession)
                                .contentType("application/json")
                                .content("{\"code\":\"" + worksheetCode + "\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/attempts/{id}", attemptId)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/attempts/{id}", attemptId).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].score").value(3));
    }

    @Test
    void childCodesProtectTeacherBoundariesAndFailedEntryKeepsExistingSession() throws Exception {
        Account teacher = signup("Teacher", "teacher.boundary@example.com", "TEACHER");
        Account other = signup("Other", "other.boundary@example.com", "TEACHER");
        Long classroomId = idFrom(createClassroom(teacher, "Private roster"));
        mvc.perform(
                        post("/api/classes/{id}/members", classroomId)
                                .session(other.session())
                                .contentType("application/json")
                                .content("{\"name\":\"Ana\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(
                        post("/api/classes/{id}/members", classroomId)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest());
        MvcResult child =
                mvc.perform(
                                post("/api/classes/{id}/members", classroomId)
                                        .session(teacher.session())
                                        .contentType("application/json")
                                        .content("{\"name\":\"Ana\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        Long childId = ((Number) JsonPath.read(body(child), "$.userId")).longValue();
        String childCode = codeFromChild(teacher, child);
        Long worksheetId = createWorksheet(other, "Other teacher worksheet");
        createItem(other, worksheetId);
        MvcResult share =
                mvc.perform(
                                post("/api/worksheets/{id}/share", worksheetId)
                                        .session(other.session()))
                        .andExpect(status().isOk())
                        .andReturn();
        String code = JsonPath.read(body(share), "$.code");
        mvc.perform(
                        post("/api/play/join")
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(entryBody(childCode, code)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/auth/me").session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(teacher.id()));
        mvc.perform(
                        post("/api/play/join")
                                .contentType("application/json")
                                .content(entryBody("UNKNOWN", code)))
                .andExpect(status().isNotFound());
        mvc.perform(
                        get("/api/classes/{id}/members/{user}/tests", classroomId, childId)
                                .session(other.session()))
                .andExpect(status().isNotFound());
        mvc.perform(
                        patch("/api/classes/{id}/members/{user}", classroomId, childId)
                                .session(other.session())
                                .contentType("application/json")
                                .content("{\"name\":\"Changed\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void existingStudentsCanUseCodesForTheCorrectClass() throws Exception {
        Account teacher = signup("Teacher", "teacher.legacy@example.com", "TEACHER");
        Account student = signup("Student", "student.legacy@example.com", "USER");
        Long firstClass = idFrom(joinClass(teacher, student, "First class"));
        Long secondClass = idFrom(joinClass(teacher, student, "Second class"));
        String firstCode =
                JsonPath.read(
                        body(
                                mvc.perform(
                                                post(
                                                                "/api/classes/{id}/members/{user}/code",
                                                                firstClass,
                                                                student.id())
                                                        .session(teacher.session()))
                                        .andExpect(status().isOk())
                                        .andReturn()),
                        "$.studentCode");
        String secondCode =
                JsonPath.read(
                        body(
                                mvc.perform(
                                                post(
                                                                "/api/classes/{id}/members/{user}/code",
                                                                secondClass,
                                                                student.id())
                                                        .session(teacher.session()))
                                        .andExpect(status().isOk())
                                        .andReturn()),
                        "$.studentCode");
        mvc.perform(
                        post("/api/classes/{id}/members/{user}/code", firstClass, student.id())
                                .session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentCode").value(firstCode));
        Long worksheetId = createWorksheet(teacher, "Shared worksheet");
        createItem(teacher, worksheetId);
        String worksheetCode =
                JsonPath.read(
                        body(
                                mvc.perform(
                                                post("/api/worksheets/{id}/share", worksheetId)
                                                        .session(teacher.session()))
                                        .andExpect(status().isOk())
                                        .andReturn()),
                        "$.code");
        org.junit.jupiter.api.Assertions.assertEquals(firstCode, secondCode);
        MvcResult joined =
                mvc.perform(
                                post("/api/play/join")
                                        .contentType("application/json")
                                        .content(entryBody(firstCode, worksheetCode)))
                        .andExpect(status().isOk())
                        .andReturn();
        Long assignmentId = ((Number) JsonPath.read(body(joined), "$.assignmentId")).longValue();
        mvc.perform(get("/api/assignments/{id}", assignmentId).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.classroomId").isEmpty());
        var promoted = users.findById(student.id()).orElseThrow();
        promoted.changeRole(com.worksheet.auth.UserRole.ADMIN);
        users.saveAndFlush(promoted);
        mvc.perform(
                        post("/api/play/join")
                                .contentType("application/json")
                                .content(entryBody(firstCode, worksheetCode)))
                .andExpect(status().isForbidden());
    }

    @Test
    void personalCodeReplacementPreservesIdentityAndCompletedWork() throws Exception {
        Account teacher = signup("Teacher", "personal.teacher@example.com", "TEACHER");
        Account other = signup("Other", "personal.other@example.com", "TEACHER");
        Long classroom = idFrom(createClassroom(teacher, "Code class"));
        var child =
                mvc.perform(
                                post("/api/classes/{id}/members", classroom)
                                        .session(teacher.session())
                                        .contentType("application/json")
                                        .content("{\"name\":\"Alex\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        Long student = ((Number) JsonPath.read(body(child), "$.userId")).longValue();
        String code = codeFromChild(teacher, child);
        Long worksheet = createWorksheet(teacher, "Personal work");
        createItem(teacher, worksheet);
        var assigned =
                mvc.perform(
                                post("/api/worksheets/{id}/assignments", worksheet)
                                        .session(teacher.session())
                                        .contentType("application/json")
                                        .content("{\"classroomId\":" + classroom + "}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        Long assignment = assignmentIdFor(assigned, student);
        var login =
                mvc.perform(
                                post("/api/play/login")
                                        .contentType("application/json")
                                        .content(
                                                "{\"studentCode\":\" "
                                                        + code.toLowerCase()
                                                        + " \"}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.id").value(student))
                        .andExpect(jsonPath("$.email").value((Object) null))
                        .andReturn();
        var session = (MockHttpSession) login.getRequest().getSession(false);
        mvc.perform(get("/api/classes/{id}/members", classroom).session(session))
                .andExpect(status().isForbidden());
        var started =
                mvc.perform(post("/api/assignments/{id}/attempts", assignment).session(session))
                        .andExpect(status().isCreated())
                        .andReturn();
        Long attempt = idFrom(started);
        Long item = ((Number) JsonPath.read(body(started), "$.items[0].id")).longValue();
        mvc.perform(
                        put("/api/attempts/{id}/items/{item}/result", attempt, item)
                                .session(session)
                                .contentType("application/json")
                                .content(
                                        "{\"outcome\":\"COMPLETED\",\"score\":3,\"maxScore\":5,\"timeSeconds\":10,\"details\":{}}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/attempts/{id}/complete", attempt).session(session))
                .andExpect(status().isOk());
        mvc.perform(
                        post("/api/classes/{id}/members/{student}/code/rotate", classroom, student)
                                .session(other.session()))
                .andExpect(status().isNotFound());
        var reset =
                mvc.perform(
                                post(
                                                "/api/classes/{id}/members/{student}/code/rotate",
                                                classroom,
                                                student)
                                        .session(teacher.session()))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.userId").value(student))
                        .andReturn();
        String replacement = JsonPath.read(body(reset), "$.studentCode");
        org.junit.jupiter.api.Assertions.assertNotEquals(code, replacement);
        mvc.perform(
                        post("/api/play/login")
                                .contentType("application/json")
                                .content("{\"studentCode\":\"" + code + "\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
        var newLogin =
                mvc.perform(
                                post("/api/play/login")
                                        .contentType("application/json")
                                        .content("{\"studentCode\":\"" + replacement + "\"}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.id").value(student))
                        .andReturn();
        mvc.perform(
                        get("/api/assignments")
                                .session((MockHttpSession) newLogin.getRequest().getSession(false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(assignment))
                .andExpect(jsonPath("$[0].status").value("COMPLETED"));
        mvc.perform(delete("/api/classes/{id}", classroom).session(teacher.session()))
                .andExpect(status().isNoContent());
        mvc.perform(
                        post("/api/play/login")
                                .contentType("application/json")
                                .content("{\"studentCode\":\"" + replacement + "\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/attempts/{id}", attempt).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalScore").value(3));
    }
}
