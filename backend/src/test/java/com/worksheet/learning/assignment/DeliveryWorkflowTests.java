package com.worksheet.learning.assignment;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

class DeliveryWorkflowTests extends TeacherScenarioSupport {
    @Test
    void createsPerUserAssignmentsWithoutBackfillingFutureMembers() throws Exception {
        Account teacher = signup("Teacher", "teacher.assign@example.com", "TEACHER");
        Account userOne = signup("One", "one.assign@example.com", "USER");
        Account userTwo = signup("Two", "two.assign@example.com", "USER");
        Long classroomId = idFrom(joinClass(teacher, userOne, "Assignments"));
        joinExistingClass(teacher, userTwo, classroomId);
        Long worksheetId = createWorksheet(teacher, "Assigned worksheet");
        createItem(teacher, worksheetId);

        MvcResult assigned =
                mvc.perform(
                                post("/api/worksheets/{id}/assignments", worksheetId)
                                        .session(teacher.session())
                                        .contentType("application/json")
                                        .content("{\"classroomId\":" + classroomId + "}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$", hasSize(2)))
                        .andExpect(jsonPath("$[0].status").value("NOT_STARTED"))
                        .andReturn();
        Long userOneAssignment = assignmentIdFor(assigned, userOne.id());

        mvc.perform(get("/api/assignments").session(userOne.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].worksheet.items", hasSize(1)));
        mvc.perform(
                        post("/api/worksheets/{id}/assignments", worksheetId)
                                .session(userOne.session())
                                .contentType("application/json")
                                .content("{\"classroomId\":" + classroomId + "}"))
                .andExpect(status().isForbidden());

        Account futureUser = signup("Future", "future.assign@example.com", "USER");
        joinExistingClass(teacher, futureUser, classroomId);
        mvc.perform(get("/api/assignments").session(futureUser.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        Account unrelated = signup("Unrelated", "unrelated.assign@example.com", "USER");
        mvc.perform(
                        post("/api/worksheets/{id}/assignments", worksheetId)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content("{\"userId\":" + unrelated.id() + "}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/assignments/{id}", userOneAssignment).session(userTwo.session()))
                .andExpect(status().isNotFound());
    }

    @Test
    void selectedRecipientsAndRepeatedDeliveriesStayIndependent() throws Exception {
        Account teacher = signup("Teacher", "batch.teacher@example.com", "TEACHER");
        Account other = signup("Other", "batch.other@example.com", "TEACHER");
        Account alex = signup("Alex", "batch.alex@example.com", "USER");
        Account maria = signup("Maria", "batch.maria@example.com", "USER");
        Account outsider = signup("Outsider", "batch.outsider@example.com", "USER");
        Long classroom = idFrom(joinClass(teacher, alex, "Batch class"));
        joinExistingClass(teacher, maria, classroom);
        Long worksheet = createWorksheet(teacher, "Frozen original");
        createItem(teacher, worksheet);
        mvc.perform(
                        post("/api/worksheets/{id}/assignments", worksheet)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content("{\"classroomId\":" + classroom + ",\"userIds\":[]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(
                        post("/api/worksheets/{id}/assignments", worksheet)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(
                                        "{\"classroomId\":"
                                                + classroom
                                                + ",\"userIds\":["
                                                + outsider.id()
                                                + "]}"))
                .andExpect(status().isNotFound());
        var first =
                mvc.perform(
                                post("/api/worksheets/{id}/assignments", worksheet)
                                        .session(teacher.session())
                                        .contentType("application/json")
                                        .content(
                                                "{\"classroomId\":"
                                                        + classroom
                                                        + ",\"userIds\":["
                                                        + alex.id()
                                                        + "]}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$", hasSize(1)))
                        .andExpect(jsonPath("$[0].classroomId").value(classroom))
                        .andReturn();
        var second =
                mvc.perform(
                                post("/api/worksheets/{id}/assignments", worksheet)
                                        .session(teacher.session())
                                        .contentType("application/json")
                                        .content("{\"classroomId\":" + classroom + "}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$", hasSize(2)))
                        .andReturn();
        String firstBatch = JsonPath.read(body(first), "$[0].batchId"),
                secondBatch = JsonPath.read(body(second), "$[0].batchId");
        org.junit.jupiter.api.Assertions.assertNotEquals(firstBatch, secondBatch);
        Long firstAssignment = assignmentIdFor(first, alex.id());
        Long attempt =
                idFrom(
                        mvc.perform(
                                        post("/api/assignments/{id}/attempts", firstAssignment)
                                                .session(alex.session()))
                                .andExpect(status().isCreated())
                                .andReturn());
        mvc.perform(get("/api/assignments/{id}", firstAssignment).session(alex.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
        mvc.perform(delete("/api/assignments/batches/{id}", firstBatch).session(other.session()))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/assignments/batches/{id}", firstBatch).session(alex.session()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/assignments/batches/{id}", firstBatch).session(teacher.session()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/assignments").session(alex.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].batchId").value(secondBatch));
        mvc.perform(get("/api/attempts/{id}", attempt).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ABANDONED"));
        mvc.perform(
                        put("/api/worksheets/{id}", worksheet)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content("{\"name\":\"Changed draft\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/assignments").session(maria.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].worksheet.name").value("Frozen original"));
        mvc.perform(get("/api/assignments/report?includeRemoved=true").session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)));
    }
}
