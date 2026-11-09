package com.worksheet.learning.attempt;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.worksheet.auth.UserRepository;
import com.worksheet.content.catalog.MiniGameDefinition;
import com.worksheet.content.catalog.MiniGameDefinitionRepository;
import com.worksheet.content.worksheet.WorksheetRepository;
import com.worksheet.content.worksheet.item.WorksheetItemRepository;
import com.worksheet.content.worksheet.revision.WorksheetRevisionItemRepository;
import com.worksheet.content.worksheet.revision.WorksheetRevisionRepository;
import com.worksheet.learning.assignment.WorksheetAssignmentRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.node.JsonNodeFactory;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:attempt-test;DB_CLOSE_DELAY=-1",
            "spring.flyway.enabled=false",
            "spring.jpa.hibernate.ddl-auto=create-drop"
        })
@AutoConfigureMockMvc
class WorksheetAttemptTests {
    @Autowired MockMvc mvc;
    @Autowired WorksheetAttemptItemResultRepository attemptResults;
    @Autowired WorksheetAttemptRepository attempts;
    @Autowired WorksheetAssignmentRepository assignments;
    @Autowired WorksheetRevisionItemRepository revisionItems;
    @Autowired WorksheetRevisionRepository revisions;
    @Autowired WorksheetItemRepository worksheetItems;
    @Autowired WorksheetRepository worksheets;
    @Autowired MiniGameDefinitionRepository definitions;
    @Autowired UserRepository users;

    private Long definitionId;

    @BeforeEach
    void cleanDatabase() {
        attemptResults.deleteAll();
        attempts.deleteAll();
        assignments.deleteAll();
        revisionItems.deleteAll();
        revisions.deleteAll();
        worksheetItems.deleteAll();
        worksheets.deleteAll();
        definitions.deleteAll();
        users.deleteAll();
        definitionId =
                definitions
                        .save(
                                new MiniGameDefinition(
                                        "Attempt game",
                                        "attempt-game",
                                        JsonNodeFactory.instance.objectNode(),
                                        true))
                        .getId();
    }

    @Test
    void freezesReusesAndVersionsWorksheetContent() throws Exception {
        Account owner = signup("Owner", "attempt.owner@example.com");
        Long worksheetId = createWorksheet(owner, "Version one");
        Long itemId = createItem(owner, worksheetId, 1);

        MvcResult first = start(owner, worksheetId);
        Long firstRevisionId = number(first, "$.revisionId");
        Long firstRevisionItemId = number(first, "$.items[0].id");
        start(owner, worksheetId).getResponse();
        mvc.perform(get("/api/worksheets/{id}/attempts", worksheetId).session(owner.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].revisionId").value(firstRevisionId));

        mvc.perform(
                        put("/api/worksheets/{worksheetId}/items/{itemId}", worksheetId, itemId)
                                .session(owner.session())
                                .contentType("application/json")
                                .content(
                                        "{\"miniGameId\":"
                                                + definitionId
                                                + ",\"orderIndex\":2,\"configuration\":{}}"))
                .andExpect(status().isOk());
        MvcResult changed = start(owner, worksheetId);
        Long secondRevisionId = number(changed, "$.revisionId");
        org.junit.jupiter.api.Assertions.assertNotEquals(firstRevisionId, secondRevisionId);
        mvc.perform(get("/api/attempts/{id}", number(first, "$.id")).session(owner.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revisionId").value(firstRevisionId))
                .andExpect(jsonPath("$.items[0].id").value(firstRevisionItemId))
                .andExpect(jsonPath("$.items[0].orderIndex").value(1));
    }

    @Test
    void savesIdempotentResultsAggregatesAndLocksCompletedAttempts() throws Exception {
        Account owner = signup("Owner", "attempt.score@example.com");
        Long worksheetId = createWorksheet(owner, "Scores");
        createItem(owner, worksheetId, 1);
        MvcResult started = start(owner, worksheetId);
        Long attemptId = number(started, "$.id");
        Long revisionItemId = number(started, "$.items[0].id");

        mvc.perform(post("/api/attempts/{id}/complete", attemptId).session(owner.session()))
                .andExpect(status().isConflict());
        String result =
                "{\"outcome\":\"COMPLETED\",\"score\":3,\"maxScore\":5,\"timeSeconds\":7,\"details\":{}}";
        mvc.perform(
                        put("/api/attempts/{id}/items/{itemId}/result", attemptId, revisionItemId)
                                .session(owner.session())
                                .contentType("application/json")
                                .content(result))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(3));
        mvc.perform(
                        put("/api/attempts/{id}/items/{itemId}/result", attemptId, revisionItemId)
                                .session(owner.session())
                                .contentType("application/json")
                                .content(result.replace("\"score\":3", "\"score\":4")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(4));
        mvc.perform(post("/api/attempts/{id}/complete", attemptId).session(owner.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.totalScore").value(4))
                .andExpect(jsonPath("$.maxScore").value(5));
        mvc.perform(
                        put("/api/attempts/{id}/items/{itemId}/result", attemptId, revisionItemId)
                                .session(owner.session())
                                .contentType("application/json")
                                .content(result))
                .andExpect(status().isConflict());
    }

    @Test
    void supportsExplicitSkipAndHidesAttemptsFromOtherUsers() throws Exception {
        Account owner = signup("Owner", "attempt.skip@example.com");
        Account stranger = signup("Stranger", "attempt.stranger@example.com");
        Long worksheetId = createWorksheet(owner, "Skip");
        createItem(owner, worksheetId, 1);
        MvcResult started = start(owner, worksheetId);
        Long attemptId = number(started, "$.id");
        Long revisionItemId = number(started, "$.items[0].id");

        mvc.perform(get("/api/attempts/{id}", attemptId).session(stranger.session()))
                .andExpect(status().isNotFound());
        mvc.perform(
                        put("/api/attempts/{id}/items/{itemId}/result", attemptId, revisionItemId)
                                .session(owner.session())
                                .contentType("application/json")
                                .content(
                                        "{\"outcome\":\"SKIPPED\",\"score\":0,\"maxScore\":5,\"timeSeconds\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("SKIPPED"));
        mvc.perform(post("/api/attempts/{id}/complete", attemptId).session(owner.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalScore").value(0));
    }

    private Account signup(String name, String email) throws Exception {
        MvcResult result =
                mvc.perform(
                                post("/api/auth/signup")
                                        .contentType("application/json")
                                        .content(
                                                "{\"name\":\""
                                                        + name
                                                        + "\",\"email\":\""
                                                        + email
                                                        + "\",\"password\":\"a long test"
                                                        + " password\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        return new Account((MockHttpSession) result.getRequest().getSession(false));
    }

    private Long createWorksheet(Account account, String name) throws Exception {
        MvcResult result =
                mvc.perform(
                                post("/api/worksheets")
                                        .session(account.session())
                                        .contentType("application/json")
                                        .content("{\"name\":\"" + name + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        return number(result, "$.id");
    }

    private Long createItem(Account account, Long worksheetId, int order) throws Exception {
        MvcResult result =
                mvc.perform(
                                post("/api/worksheets/{id}/items", worksheetId)
                                        .session(account.session())
                                        .contentType("application/json")
                                        .content(
                                                "{\"miniGameId\":"
                                                        + definitionId
                                                        + ",\"orderIndex\":"
                                                        + order
                                                        + ",\"configuration\":{}}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        return number(result, "$.id");
    }

    private MvcResult start(Account account, Long worksheetId) throws Exception {
        return mvc.perform(
                        post("/api/worksheets/{id}/attempts", worksheetId)
                                .session(account.session()))
                .andExpect(status().isCreated())
                .andReturn();
    }

    private Long number(MvcResult result, String path) throws Exception {
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), path))
                .longValue();
    }

    private record Account(MockHttpSession session) {}
}
