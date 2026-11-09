package com.worksheet.learning.assignment;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.worksheet.auth.UserRepository;
import com.worksheet.content.catalog.MiniGameDefinition;
import com.worksheet.content.catalog.MiniGameDefinitionRepository;
import com.worksheet.content.worksheet.WorksheetRepository;
import com.worksheet.content.worksheet.item.WorksheetItemRepository;
import com.worksheet.content.worksheet.revision.WorksheetRevisionItemRepository;
import com.worksheet.content.worksheet.revision.WorksheetRevisionRepository;
import com.worksheet.learning.attempt.WorksheetAttemptItemResultRepository;
import com.worksheet.learning.attempt.WorksheetAttemptRepository;
import com.worksheet.learning.legacy.result.WorksheetResultRepository;
import com.worksheet.learning.legacy.result.minigame.MiniGameResultRepository;
import com.worksheet.teaching.classroom.ClassroomMemberRepository;
import com.worksheet.teaching.classroom.ClassroomRepository;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.node.JsonNodeFactory;

import java.util.List;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:teacher-architecture-test;DB_CLOSE_DELAY=-1",
            "spring.flyway.enabled=false",
            "spring.jpa.hibernate.ddl-auto=create-drop"
        })
@AutoConfigureMockMvc
abstract class TeacherScenarioSupport {
    @Autowired MockMvc mvc;
    @Autowired MiniGameResultRepository miniGameResults;
    @Autowired WorksheetResultRepository worksheetResults;
    @Autowired WorksheetAttemptItemResultRepository attemptItemResults;
    @Autowired WorksheetAttemptRepository attempts;
    @Autowired WorksheetAssignmentRepository assignments;
    @Autowired ClassroomMemberRepository members;
    @Autowired ClassroomRepository classrooms;
    @Autowired WorksheetItemRepository worksheetItems;
    @Autowired WorksheetRevisionItemRepository revisionItems;
    @Autowired WorksheetRevisionRepository revisions;
    @Autowired WorksheetRepository worksheets;
    @Autowired MiniGameDefinitionRepository miniGames;
    @Autowired UserRepository users;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

    protected Long miniGameId;

    @BeforeEach
    void setUp() {
        miniGameResults.deleteAll();
        worksheetResults.deleteAll();
        attemptItemResults.deleteAll();
        attempts.deleteAll();
        assignments.deleteAll();
        members.deleteAll();
        classrooms.deleteAll();
        jdbc.update("UPDATE worksheet SET share_revision_id = NULL");
        revisionItems.deleteAll();
        revisions.deleteAll();
        worksheetItems.deleteAll();
        worksheets.deleteAll();
        miniGames.deleteAll();
        users.deleteAll();
        miniGameId =
                miniGames
                        .save(
                                new MiniGameDefinition(
                                        "Teacher test",
                                        "teacher-test",
                                        JsonNodeFactory.instance.objectNode(),
                                        true))
                        .getId();
    }

    protected RemovalFixture removalFixture() throws Exception {
        var teacher = signup("Teacher", "remove.teacher@example.com", "TEACHER");
        var other = signup("Other", "remove.other@example.com", "TEACHER");
        var student = signup("Ana", "remove.ana@example.com", "USER");
        var second = signup("Dan", "remove.dan@example.com", "USER");
        Long classroom = idFrom(joinClass(teacher, student, "Class A"));
        joinExistingClass(teacher, second, classroom);
        Long otherClass = idFrom(joinClass(teacher, student, "Class B"));
        joinExistingClass(teacher, second, otherClass);
        String studentCode =
                JsonPath.read(
                        body(
                                mvc.perform(
                                                post(
                                                                "/api/classes/{id}/members/{user}/code",
                                                                classroom,
                                                                student.id())
                                                        .session(teacher.session()))
                                        .andExpect(status().isOk())
                                        .andReturn()),
                        "$.studentCode");
        Long worksheet = createWorksheet(teacher, "Removal test");
        createItem(teacher, worksheet);
        String code =
                JsonPath.read(
                        body(
                                mvc.perform(
                                                post("/api/classes/{id}/tests", classroom)
                                                        .session(teacher.session())
                                                        .contentType("application/json")
                                                        .content(
                                                                "{\"worksheetId\":"
                                                                        + worksheet
                                                                        + "}"))
                                        .andExpect(status().isCreated())
                                        .andReturn()),
                        "$.code");
        var assigned =
                mvc.perform(
                                post("/api/worksheets/{id}/assignments", worksheet)
                                        .session(teacher.session())
                                        .contentType("application/json")
                                        .content("{\"classroomId\":" + classroom + "}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        Long completedAssignment = assignmentIdFor(assigned, student.id());
        Long activeAssignment = assignmentIdFor(assigned, second.id());
        var attempt =
                mvc.perform(
                                post("/api/assignments/{id}/attempts", completedAssignment)
                                        .session(student.session()))
                        .andExpect(status().isCreated())
                        .andReturn();
        Long completedAttempt = idFrom(attempt);
        Long item = ((Number) JsonPath.read(body(attempt), "$.items[0].id")).longValue();
        Long revision = ((Number) JsonPath.read(body(attempt), "$.revisionId")).longValue();
        mvc.perform(
                        put("/api/attempts/{id}/items/{item}/result", completedAttempt, item)
                                .session(student.session())
                                .contentType("application/json")
                                .content(
                                        "{\"outcome\":\"COMPLETED\",\"score\":3,\"maxScore\":5,\"timeSeconds\":10,\"details\":{}}"))
                .andExpect(status().isOk());
        mvc.perform(
                        post("/api/attempts/{id}/complete", completedAttempt)
                                .session(student.session()))
                .andExpect(status().isOk());
        Long activeAttempt =
                idFrom(
                        mvc.perform(
                                        post("/api/assignments/{id}/attempts", activeAssignment)
                                                .session(second.session()))
                                .andExpect(status().isCreated())
                                .andReturn());
        mvc.perform(
                        post("/api/worksheets/{id}/assignments", worksheet)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content("{\"classroomId\":" + otherClass + "}"))
                .andExpect(status().isCreated());
        return new RemovalFixture(
                teacher,
                other,
                student,
                second,
                classroom,
                otherClass,
                worksheet,
                revision,
                completedAssignment,
                completedAttempt,
                activeAttempt,
                studentCode,
                code);
    }

    protected record RemovalFixture(
            Account teacher,
            Account other,
            Account student,
            Account second,
            Long classroomId,
            Long otherClassId,
            Long worksheetId,
            Long revisionId,
            Long completedAssignment,
            Long completedAttempt,
            Long activeAttempt,
            String studentCode,
            String worksheetCode) {}

    protected String codeFromChild(Account teacher, MvcResult child) throws Exception {
        long profile = ((Number) JsonPath.read(body(child), "$.studentId")).longValue();
        long space =
                ((Number)
                                JsonPath.read(
                                        body(
                                                mvc.perform(
                                                                get("/api/auth/context")
                                                                        .session(teacher.session()))
                                                        .andReturn()),
                                        "$.spaceId"))
                        .longValue();
        return JsonPath.read(
                body(
                        mvc.perform(
                                        post("/api/spaces/"
                                                        + space
                                                        + "/students/"
                                                        + profile
                                                        + "/credential")
                                                .session(teacher.session()))
                                .andExpect(status().isOk())
                                .andReturn()),
                "$.code");
    }

    protected String entryBody(String studentCode, String worksheetCode) {
        return "{\"studentCode\":\""
                + studentCode
                + "\",\"worksheetCode\":\""
                + worksheetCode
                + "\"}";
    }

    protected Account signup(String name, String email, String role) throws Exception {
        String roleJson = role == null ? "" : ",\"role\":\"" + role + "\"";
        MvcResult result =
                mvc.perform(
                                post("/api/auth/signup")
                                        .header("X-Auth-Request", "1")
                                        .contentType("application/json")
                                        .content(
                                                "{\"name\":\""
                                                        + name
                                                        + "\",\"email\":\""
                                                        + email
                                                        + "\",\"password\":\"a long test password\""
                                                        + roleJson
                                                        + "}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        return new Account((MockHttpSession) result.getRequest().getSession(false), idFrom(result));
    }

    protected MvcResult createClassroom(Account teacher, String name) throws Exception {
        return mvc.perform(
                        post("/api/classes")
                                .session(teacher.session())
                                .contentType("application/json")
                                .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();
    }

    protected MvcResult joinClass(Account teacher, Account user, String name) throws Exception {
        MvcResult classroom = createClassroom(teacher, name);
        String code = JsonPath.read(body(classroom), "$.joinCode");
        mvc.perform(
                        post("/api/classes/join")
                                .session(user.session())
                                .contentType("application/json")
                                .content("{\"joinCode\":\"" + code + "\"}"))
                .andExpect(status().isCreated());
        return classroom;
    }

    protected void joinExistingClass(Account teacher, Account user, Long classroomId)
            throws Exception {
        MvcResult classroom =
                mvc.perform(get("/api/classes/{id}", classroomId).session(teacher.session()))
                        .andExpect(status().isOk())
                        .andReturn();
        String code = JsonPath.read(body(classroom), "$.joinCode");
        mvc.perform(
                        post("/api/classes/join")
                                .session(user.session())
                                .contentType("application/json")
                                .content("{\"joinCode\":\"" + code + "\"}"))
                .andExpect(status().isCreated());
    }

    protected Long createWorksheet(Account account, String name) throws Exception {
        MvcResult result =
                mvc.perform(
                                post("/api/worksheets")
                                        .session(account.session())
                                        .contentType("application/json")
                                        .content("{\"name\":\"" + name + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        return idFrom(result);
    }

    protected Long createItem(Account account, Long worksheetId) throws Exception {
        MvcResult result =
                mvc.perform(
                                post("/api/worksheets/{id}/items", worksheetId)
                                        .session(account.session())
                                        .contentType("application/json")
                                        .content(
                                                "{\"miniGameId\":"
                                                        + miniGameId
                                                        + ",\"orderIndex\":1,\"configuration\":{}}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        return idFrom(result);
    }

    protected Long assignmentIdFor(MvcResult result, Long userId) throws Exception {
        List<Number> ids = JsonPath.read(body(result), "$[?(@.userId == " + userId + ")].id");
        return ids.getFirst().longValue();
    }

    protected String miniResultBody(Long itemId) {
        return "{\"worksheetItemId\":"
                + itemId
                + ",\"score\":3,\"maxScore\":5,\"timeSeconds\":10,\"details\":{}}";
    }

    protected Long idFrom(MvcResult result) throws Exception {
        return ((Number) JsonPath.read(body(result), "$.id")).longValue();
    }

    protected String body(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString();
    }

    protected record Account(MockHttpSession session, Long id) {}
}
