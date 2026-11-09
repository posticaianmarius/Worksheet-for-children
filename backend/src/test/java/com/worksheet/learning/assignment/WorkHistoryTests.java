package com.worksheet.learning.assignment;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

class WorkHistoryTests extends TeacherScenarioSupport {
    @Test
    void recordsAssignedResultsAndRevokesAccessWithoutDeletingHistory() throws Exception {
        Account teacher = signup("Teacher", "teacher.results@example.com", "TEACHER");
        Account otherTeacher = signup("Other Teacher", "other.results@example.com", "TEACHER");
        Account user = signup("Student", "student.results@example.com", "USER");
        Long classroomId = idFrom(joinClass(teacher, user, "Results"));
        Long worksheetId = createWorksheet(teacher, "Results worksheet");
        Long itemId = createItem(teacher, worksheetId);
        MvcResult assigned =
                mvc.perform(
                                post("/api/worksheets/{id}/assignments", worksheetId)
                                        .session(teacher.session())
                                        .contentType("application/json")
                                        .content("{\"classroomId\":" + classroomId + "}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$", hasSize(1)))
                        .andReturn();
        Long assignmentId = ((Number) JsonPath.read(body(assigned), "$[0].id")).longValue();

        MvcResult result =
                mvc.perform(
                                post("/api/assignments/{id}/results", assignmentId)
                                        .session(user.session())
                                        .contentType("application/json")
                                        .content("{\"totalScore\":3,\"maxScore\":5}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.assignmentId").value(assignmentId))
                        .andReturn();
        Long resultId = idFrom(result);
        mvc.perform(
                        post("/api/worksheet-results/{id}/mini-game-results", resultId)
                                .session(user.session())
                                .contentType("application/json")
                                .content(miniResultBody(itemId)))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/assignments/{id}/results", assignmentId).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(
                        get("/api/assignments/{id}/results", assignmentId)
                                .session(otherTeacher.session()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/worksheets/{id}/results", worksheetId).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(
                        delete(
                                        "/api/worksheets/{worksheetId}/results/{resultId}",
                                        worksheetId,
                                        resultId)
                                .session(teacher.session()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/worksheets/{id}", worksheetId).session(user.session()))
                .andExpect(status().isNotFound());
        mvc.perform(
                        get("/api/worksheet-results/{id}/mini-game-results", resultId)
                                .session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(
                        post("/api/worksheet-results/{id}/mini-game-results", resultId)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(miniResultBody(itemId)))
                .andExpect(status().isNotFound());

        MvcResult activeAttempt =
                mvc.perform(
                                post("/api/assignments/{id}/attempts", assignmentId)
                                        .session(user.session()))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                        .andReturn();
        Long attemptId = idFrom(activeAttempt);

        mvc.perform(
                        delete("/api/classes/{classId}/members/{userId}", classroomId, user.id())
                                .session(teacher.session()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/assignments").session(user.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/assignments/{id}", assignmentId).session(user.session()))
                .andExpect(status().isOk());
        mvc.perform(
                        post("/api/assignments/{id}/results", assignmentId)
                                .session(user.session())
                                .contentType("application/json")
                                .content("{\"totalScore\":4,\"maxScore\":5}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/assignments/{id}", assignmentId).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));
        mvc.perform(get("/api/assignments/{id}/results", assignmentId).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/attempts/{id}", attemptId).session(user.session()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/assignments/{id}/attempts", assignmentId).session(user.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/attempts/{id}", attemptId).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ABANDONED"));
    }

    @Test
    void removingHomeworkPersistsRevokesEveryRecipientAndPreservesHistoryAndOtherClasses()
            throws Exception {
        var f = removalFixture();
        String route =
                "/api/assignments/classes/" + f.classroomId() + "/revisions/" + f.revisionId();
        mvc.perform(delete(route).session(f.other().session())).andExpect(status().isNotFound());
        mvc.perform(delete(route).session(f.student().session())).andExpect(status().isForbidden());
        mvc.perform(delete(route)).andExpect(status().isUnauthorized());
        mvc.perform(delete(route).session(f.teacher().session())).andExpect(status().isNoContent());
        mvc.perform(delete(route).session(f.teacher().session())).andExpect(status().isNoContent());
        mvc.perform(get("/api/assignments/report").session(f.teacher().session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].classroomId").value(f.otherClassId()));
        mvc.perform(
                        get("/api/assignments/report?includeRemoved=true")
                                .session(f.teacher().session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(6)));
        mvc.perform(
                        get("/api/assignments/{id}/attempts", f.completedAssignment())
                                .session(f.teacher().session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].totalScore").value(3));
        mvc.perform(get("/api/attempts/{id}", f.completedAttempt()).session(f.teacher().session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.results[0].score").value(3));
        mvc.perform(get("/api/attempts/{id}", f.activeAttempt()).session(f.teacher().session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ABANDONED"));
        mvc.perform(
                        post("/api/assignments/{id}/attempts", f.completedAssignment())
                                .session(f.student().session()))
                .andExpect(status().isNotFound());
        mvc.perform(
                        post("/api/attempts/{id}/complete", f.activeAttempt())
                                .session(f.second().session()))
                .andExpect(status().isNotFound());
        mvc.perform(
                        post("/api/play/join")
                                .contentType("application/json")
                                .content(entryBody(f.studentCode(), f.worksheetCode())))
                .andExpect(status().isOk());
        mvc.perform(
                        post("/api/worksheets/join")
                                .session(f.student().session())
                                .contentType("application/json")
                                .content("{\"code\":\"" + f.worksheetCode() + "\"}"))
                .andExpect(status().isOk());
        // A new member must not resurrect removed homework by entering its old worksheet code.
        var child =
                mvc.perform(
                                post("/api/classes/{id}/members", f.classroomId())
                                        .session(f.teacher().session())
                                        .contentType("application/json")
                                        .content("{\"name\":\"New child\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        String newCode = codeFromChild(f.teacher(), child);
        mvc.perform(
                        post("/api/play/join")
                                .contentType("application/json")
                                .content(entryBody(newCode, f.worksheetCode())))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/worksheets/{id}", f.worksheetId()).session(f.teacher().session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)));
        // Explicitly assigning the same revision again is permitted; old history stays frozen.
        mvc.perform(
                        post("/api/classes/{id}/tests", f.classroomId())
                                .session(f.teacher().session())
                                .contentType("application/json")
                                .content("{\"worksheetId\":" + f.worksheetId() + "}"))
                .andExpect(status().isCreated());
        mvc.perform(
                        post("/api/play/join")
                                .contentType("application/json")
                                .content(entryBody(f.studentCode(), f.worksheetCode())))
                .andExpect(status().isConflict());
    }

    @Test
    void archivingClassPersistsDisablesCodesAndKeepsCompletedScoresReadable() throws Exception {
        var f = removalFixture();
        String oldCode =
                JsonPath.read(
                        body(
                                mvc.perform(
                                                get("/api/classes/{id}", f.classroomId())
                                                        .session(f.teacher().session()))
                                        .andReturn()),
                        "$.joinCode");
        String route = "/api/classes/" + f.classroomId();
        mvc.perform(delete(route).session(f.other().session())).andExpect(status().isNotFound());
        mvc.perform(delete(route).session(f.student().session())).andExpect(status().isForbidden());
        mvc.perform(delete(route)).andExpect(status().isUnauthorized());
        mvc.perform(delete(route).session(f.teacher().session())).andExpect(status().isNoContent());
        mvc.perform(delete(route).session(f.teacher().session())).andExpect(status().isNoContent());
        mvc.perform(get("/api/classes").session(f.teacher().session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value(f.otherClassId()));
        mvc.perform(get(route).session(f.teacher().session())).andExpect(status().isOk());
        mvc.perform(
                        post("/api/classes/join")
                                .session(f.student().session())
                                .contentType("application/json")
                                .content("{\"joinCode\":\"" + oldCode + "\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(
                        post("/api/play/join")
                                .contentType("application/json")
                                .content(entryBody(f.studentCode(), f.worksheetCode())))
                .andExpect(status().isOk());
        mvc.perform(
                        post("/api/classes/{id}/tests", f.classroomId())
                                .session(f.teacher().session())
                                .contentType("application/json")
                                .content("{\"worksheetId\":" + f.worksheetId() + "}"))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/assignments/report").session(f.teacher().session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
        mvc.perform(
                        get("/api/assignments/report?includeRemoved=true")
                                .session(f.teacher().session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(6)));
        mvc.perform(get("/api/attempts/{id}", f.completedAttempt()).session(f.teacher().session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalScore").value(3));
        mvc.perform(get("/api/attempts/{id}", f.activeAttempt()).session(f.teacher().session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ABANDONED"));
        mvc.perform(get("/api/attempts/{id}", f.completedAttempt()).session(f.student().session()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/assignments/report?includeRemoved=true").session(f.other().session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void removedDirectHomeworkCannotBeRedeemedAgain() throws Exception {
        var teacher = signup("Teacher", "direct.teacher@example.com", "TEACHER");
        var other = signup("Other", "direct.other@example.com", "TEACHER");
        var student = signup("Student", "direct.student@example.com", "USER");
        Long worksheet = createWorksheet(teacher, "Direct homework");
        createItem(teacher, worksheet);
        String code =
                JsonPath.read(
                        body(
                                mvc.perform(
                                                post("/api/worksheets/{id}/share", worksheet)
                                                        .session(teacher.session()))
                                        .andReturn()),
                        "$.code");
        var joined =
                mvc.perform(
                                post("/api/worksheets/join")
                                        .session(student.session())
                                        .contentType("application/json")
                                        .content("{\"code\":\"" + code + "\"}"))
                        .andExpect(status().isOk())
                        .andReturn();
        Long assignment = ((Number) JsonPath.read(body(joined), "$.assignmentId")).longValue();
        Long revision =
                assignments.findById(assignment).orElseThrow().getWorksheetRevision().getId();
        String route = "/api/assignments/direct/revisions/" + revision;
        mvc.perform(delete(route).session(other.session())).andExpect(status().isNotFound());
        mvc.perform(delete(route).session(teacher.session())).andExpect(status().isNoContent());
        mvc.perform(
                        post("/api/worksheets/join")
                                .session(student.session())
                                .contentType("application/json")
                                .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/assignments").session(student.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }
}
