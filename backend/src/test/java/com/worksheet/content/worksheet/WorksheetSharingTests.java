package com.worksheet.content.worksheet;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.worksheet.content.catalog.JsonSchemaValidationService;
import com.worksheet.content.catalog.MiniGameDataInitializer;
import com.worksheet.content.catalog.MiniGameDefinition;
import com.worksheet.content.catalog.MiniGameDefinitionRepository;
import com.worksheet.content.worksheet.revision.WorksheetRevisionRepository;
import com.worksheet.learning.assignment.WorksheetAssignmentRepository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

import tools.jackson.databind.ObjectMapper;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:worksheet-sharing-test;DB_CLOSE_DELAY=-1",
            "spring.flyway.enabled=false",
            "spring.jpa.hibernate.ddl-auto=create-drop"
        })
@AutoConfigureMockMvc
class WorksheetSharingTests {
    @Autowired MockMvc mvc;
    @Autowired MiniGameDefinitionRepository definitions;
    @Autowired WorksheetAssignmentRepository assignments;
    @Autowired WorksheetRevisionRepository revisions;
    @Autowired JsonSchemaValidationService schemaValidator;
    @Autowired MiniGameDataInitializer initializer;
    @Autowired ObjectMapper mapper;

    @Test
    void joiningCreatesOneAssignmentAndReadsThePinnedRevision() throws Exception {
        MockHttpSession teacher =
                signup("Sharing Teacher", "sharing.teacher@example.com", "TEACHER");
        MockHttpSession student = signup("Sharing Student", "sharing.student@example.com", "USER");
        Long worksheetId = createWorksheet(teacher, "Original worksheet");
        createMathItem(teacher, worksheetId);

        String firstCode = share(teacher, worksheetId);
        var firstJoin =
                mvc.perform(
                                post("/api/worksheets/join")
                                        .session(student)
                                        .contentType("application/json")
                                        .content("{\"code\":\"" + firstCode.toLowerCase() + "\"}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.id").value(worksheetId))
                        .andExpect(jsonPath("$.name").value("Original worksheet"))
                        .andExpect(jsonPath("$.items.length()").value(1))
                        .andExpect(jsonPath("$.assignmentId").isNumber())
                        .andReturn();
        Long assignmentId = ((Number) JsonPath.read(body(firstJoin), "$.assignmentId")).longValue();

        mvc.perform(
                        post("/api/worksheets/join")
                                .session(student)
                                .contentType("application/json")
                                .content("{\"code\":\"" + firstCode + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignmentId").value(assignmentId));
        assertEquals(1, assignments.count());

        mvc.perform(
                        put("/api/worksheets/{id}", worksheetId)
                                .session(teacher)
                                .contentType("application/json")
                                .content("{\"name\":\"New draft\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/assignments/{id}", assignmentId).session(student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.worksheet.name").value("Original worksheet"));
        mvc.perform(post("/api/assignments/{id}/attempts", assignmentId).session(student))
                .andExpect(status().isCreated());

        String secondCode = rotate(teacher, worksheetId);
        assertNotEquals(firstCode, secondCode);
        assertTrue(
                revisions
                                .findFirstByWorksheet_IdOrderByRevisionNumberDesc(worksheetId)
                                .orElseThrow()
                                .getRevisionNumber()
                        >= 2);

        MockHttpSession secondStudent =
                signup("Second Student", "second.student@example.com", "USER");
        mvc.perform(
                        post("/api/worksheets/join")
                                .session(secondStudent)
                                .contentType("application/json")
                                .content("{\"code\":\"" + firstCode + "\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(
                        post("/api/worksheets/join")
                                .session(secondStudent)
                                .contentType("application/json")
                                .content("{\"code\":\"" + secondCode + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("New draft"));

        mvc.perform(delete("/api/worksheets/{id}", worksheetId).session(teacher))
                .andExpect(status().isConflict());
    }

    @Test
    void sharingRequiresTeacherOwnershipAndAtLeastOneItem() throws Exception {
        MockHttpSession teacher = signup("Empty Teacher", "empty.teacher@example.com", "TEACHER");
        MockHttpSession student = signup("Wrong Role", "wrong.role@example.com", "USER");
        Long worksheetId = createWorksheet(teacher, "Empty worksheet");

        mvc.perform(post("/api/worksheets/{id}/share", worksheetId).session(teacher))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/worksheets/{id}/share", worksheetId).session(student))
                .andExpect(status().isForbidden());
    }

    @Test
    void seededSchemasValidateDefaultsAndRejectInvalidConfiguration() throws Exception {
        long definitionCount = definitions.count();
        initializer.run();
        assertEquals(definitionCount, definitions.count());

        for (MiniGameDefinition definition :
                definitions.findByActiveTrueOrderByTypeAscVersionDesc()) {
            assertDoesNotThrow(
                    () ->
                            schemaValidator.validate(
                                    definition.getConfigurationSchema(),
                                    definition.getDefaultConfiguration(),
                                    definition.getName()));
        }

        MiniGameDefinition math =
                definitions.findByActiveTrueOrderByTypeAscVersionDesc().stream()
                        .filter(value -> value.getType().equals("math-game"))
                        .findFirst()
                        .orElseThrow();
        Long worksheetId =
                createWorksheet(
                        signup("Schema Teacher", "schema.seed.teacher@example.com", "TEACHER"),
                        "Schema worksheet");
        MockHttpSession teacher = login("schema.seed.teacher@example.com");
        mvc.perform(
                        post("/api/worksheets/{id}/items", worksheetId)
                                .session(teacher)
                                .contentType("application/json")
                                .content(
                                        "{\"miniGameId\":"
                                                + math.getId()
                                                + ",\"orderIndex\":0,\"configuration\":{\"maxNumber\":-1,\"operations\":false}}"))
                .andExpect(status().isBadRequest());
    }

    private MockHttpSession signup(String name, String email, String role) throws Exception {
        var result =
                mvc.perform(
                                post("/api/auth/signup")
                                        .header("X-Auth-Request", "1")
                                        .contentType("application/json")
                                        .content(
                                                "{\"name\":\""
                                                        + name
                                                        + "\",\"email\":\""
                                                        + email
                                                        + "\",\"password\":\"a long test"
                                                        + " password\",\"role\":\""
                                                        + role
                                                        + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private MockHttpSession login(String email) throws Exception {
        var result =
                mvc.perform(
                                post("/api/auth/login")
                                        .header("X-Auth-Request", "1")
                                        .contentType("application/json")
                                        .content(
                                                "{\"email\":\""
                                                        + email
                                                        + "\",\"password\":\"a long test"
                                                        + " password\"}"))
                        .andExpect(status().isOk())
                        .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private Long createWorksheet(MockHttpSession session, String name) throws Exception {
        var result =
                mvc.perform(
                                post("/api/worksheets")
                                        .session(session)
                                        .contentType("application/json")
                                        .content("{\"name\":\"" + name + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        return ((Number) JsonPath.read(body(result), "$.id")).longValue();
    }

    private void createMathItem(MockHttpSession session, Long worksheetId) throws Exception {
        Long definitionId =
                definitions.findByActiveTrueOrderByTypeAscVersionDesc().stream()
                        .filter(value -> value.getType().equals("math-game"))
                        .findFirst()
                        .orElseThrow()
                        .getId();
        mvc.perform(
                        post("/api/worksheets/{id}/items", worksheetId)
                                .session(session)
                                .contentType("application/json")
                                .content(
                                        "{\"miniGameId\":"
                                                + definitionId
                                                + ",\"orderIndex\":0,\"configuration\":{\"maxNumber\":10,"
                                                + "\"operations\":[\"+\",\"-\"]}}"))
                .andExpect(status().isCreated());
    }

    private String share(MockHttpSession session, Long worksheetId) throws Exception {
        var result =
                mvc.perform(post("/api/worksheets/{id}/share", worksheetId).session(session))
                        .andExpect(status().isOk())
                        .andReturn();
        return JsonPath.read(body(result), "$.code");
    }

    private String rotate(MockHttpSession session, Long worksheetId) throws Exception {
        var result =
                mvc.perform(post("/api/worksheets/{id}/share/rotate", worksheetId).session(session))
                        .andExpect(status().isOk())
                        .andReturn();
        return JsonPath.read(body(result), "$.code");
    }

    private String body(org.springframework.test.web.servlet.MvcResult result) throws Exception {
        return result.getResponse().getContentAsString();
    }
}
