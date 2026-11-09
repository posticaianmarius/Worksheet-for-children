package com.worksheet.content.catalog;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.worksheet.auth.UserRepository;
import com.worksheet.auth.UserRole;
import com.worksheet.content.catalog.asset.MiniGameAssetRepository;
import com.worksheet.content.worksheet.WorksheetRepository;
import com.worksheet.content.worksheet.item.WorksheetItemRepository;
import com.worksheet.content.worksheet.revision.WorksheetRevisionItemRepository;
import com.worksheet.content.worksheet.revision.WorksheetRevisionRepository;
import com.worksheet.learning.assignment.WorksheetAssignmentRepository;
import com.worksheet.learning.attempt.WorksheetAttemptItemResultRepository;
import com.worksheet.learning.attempt.WorksheetAttemptRepository;
import com.worksheet.learning.legacy.result.WorksheetResultRepository;
import com.worksheet.learning.legacy.result.minigame.MiniGameResultRepository;
import com.worksheet.teaching.classroom.ClassroomMemberRepository;
import com.worksheet.teaching.classroom.ClassroomRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:dynamic-minigame-test;DB_CLOSE_DELAY=-1",
            "spring.flyway.enabled=false",
            "spring.jpa.hibernate.ddl-auto=create-drop",
            "app.minigame-asset-directory=./target/dynamic-minigame-test-assets"
        })
@AutoConfigureMockMvc
class DynamicMiniGameTests {
    private static final String CONFIG_SCHEMA =
            """
            {"type":"object","required":["difficulty"],"properties":{"difficulty":{"type":"integer","minimum":1,"maximum":3}},"additionalProperties":false}
            """;
    private static final String RESULT_SCHEMA =
            """
            {"type":"object","required":["moves"],"properties":{"moves":{"type":"integer","minimum":0}},"additionalProperties":false}
            """;

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
    @Autowired MiniGameDefinitionRepository definitions;
    @Autowired MiniGameAssetRepository assets;
    @Autowired UserRepository users;
    @Autowired MiniGameDataInitializer initializer;

    @BeforeEach
    void cleanDatabase() {
        miniGameResults.deleteAll();
        worksheetResults.deleteAll();
        attemptItemResults.deleteAll();
        attempts.deleteAll();
        assignments.deleteAll();
        members.deleteAll();
        classrooms.deleteAll();
        revisionItems.deleteAll();
        revisions.deleteAll();
        worksheetItems.deleteAll();
        worksheets.deleteAll();
        definitions.deleteAll();
        assets.deleteAll();
        users.deleteAll();
    }

    @ParameterizedTest
    @CsvSource({
        "math-game, '{\"maxNumber\":73,\"exerciseCount\":37,\"operations\":[\"*\",\"/\"]}'",
        "sequence-game, '{\"maxNumber\":73,\"exerciseCount\":37}'",
        "higher-lower-game, '{\"maxNumber\":73,\"exerciseCount\":37}'",
        "odd-even-game, '{\"maxNumber\":73,\"exerciseCount\":37}'",
        "color-game,"
            + " '{\"letter\":\"a\",\"animals\":[{\"id\":\"bear\",\"name\":\"Ana\",\"img\":\"/img/BearImg.webp\"}]}'",
        "matching-game, '{\"pairs\":[{\"id\":\"custom\",\"number\":17,\"emoji\":\"🍇\"}]}'"
    })
    void editedBuiltInSettingsSurviveSavingAndReloading(String type, String configuration)
            throws Exception {
        // Exercise the real seeded contract and HTTP persistence, not a permissive mock catalog.
        initializer.run();
        var definition = definitions.findByTypeIgnoreCaseAndVersion(type, 1).orElseThrow();
        Account teacher = signup("Teacher", "settings@example.com", "TEACHER");
        Long worksheetId = createWorksheet(teacher);
        Long itemId =
                idFrom(
                        mvc.perform(
                                        post("/api/worksheets/{id}/items", worksheetId)
                                                .session(teacher.session())
                                                .contentType("application/json")
                                                .content(
                                                        "{\"miniGameId\":"
                                                                + definition.getId()
                                                                + ",\"orderIndex\":0}"))
                                .andExpect(status().isCreated())
                                .andReturn());
        mvc.perform(
                        put("/api/worksheets/{id}/items/{itemId}", worksheetId, itemId)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(
                                        "{\"miniGameId\":"
                                                + definition.getId()
                                                + ",\"orderIndex\":0,\"configuration\":"
                                                + configuration
                                                + "}"))
                .andExpect(status().isOk());
        Object expectedConfiguration = JsonPath.read(configuration, "$");
        mvc.perform(get("/api/worksheets/{id}/items", worksheetId).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].configuration").value(expectedConfiguration));
        mvc.perform(get("/api/worksheets/{id}", worksheetId).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].configuration").value(expectedConfiguration));
    }

    @ParameterizedTest
    @CsvSource({"math-game", "sequence-game", "higher-lower-game", "odd-even-game"})
    void numberGameDefaultsAndExerciseCountLimitsMatchTheEditor(String type) throws Exception {
        initializer.run();
        var definition = definitions.findByTypeIgnoreCaseAndVersion(type, 1).orElseThrow();
        Account teacher = signup("Teacher", "count@example.com", "TEACHER");
        Long worksheetId = createWorksheet(teacher);
        Long itemId =
                idFrom(
                        mvc.perform(
                                        post("/api/worksheets/{id}/items", worksheetId)
                                                .session(teacher.session())
                                                .contentType("application/json")
                                                .content(
                                                        "{\"miniGameId\":"
                                                                + definition.getId()
                                                                + ",\"orderIndex\":0}"))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.configuration.exerciseCount").value(10))
                                .andReturn());
        for (String count : new String[] {"1", "100", "0", "101", "1.5", "null", "\"20\""}) {
            var configuration =
                    (tools.jackson.databind.node.ObjectNode)
                            definition.getDefaultConfiguration().deepCopy();
            configuration.set(
                    "exerciseCount", new tools.jackson.databind.ObjectMapper().readTree(count));
            mvc.perform(
                            put("/api/worksheets/{id}/items/{itemId}", worksheetId, itemId)
                                    .session(teacher.session())
                                    .contentType("application/json")
                                    .content(
                                            "{\"miniGameId\":"
                                                    + definition.getId()
                                                    + ",\"orderIndex\":0,\"configuration\":"
                                                    + configuration
                                                    + "}"))
                    .andExpect(
                            count.equals("1") || count.equals("100")
                                    ? status().isOk()
                                    : status().isBadRequest());
        }
        // Historical worksheets did not store exerciseCount; that remains a valid payload.
        var legacy =
                (tools.jackson.databind.node.ObjectNode)
                        definition.getDefaultConfiguration().deepCopy();
        legacy.remove("exerciseCount");
        mvc.perform(
                        put("/api/worksheets/{id}/items/{itemId}", worksheetId, itemId)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(
                                        "{\"miniGameId\":"
                                                + definition.getId()
                                                + ",\"orderIndex\":0,\"configuration\":"
                                                + legacy
                                                + "}"))
                .andExpect(status().isOk());
    }

    @ParameterizedTest
    @CsvSource({
        "math-game",
        "sequence-game",
        "higher-lower-game",
        "odd-even-game",
        "color-game",
        "matching-game"
    })
    void builtInPhotosAndEditedSettingsSurviveSaveUpdateReloadAndPublishedHistory(String type)
            throws Exception {
        initializer.run();
        var definition = definitions.findByTypeIgnoreCaseAndVersion(type, 3).orElseThrow();
        Account teacher = signup("Teacher", "photos@example.com", "TEACHER");
        long worksheet = createWorksheet(teacher);
        byte[] png =
                java.util.Base64.getDecoder()
                        .decode(
                                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=");
        long first =
                idFrom(
                        mvc.perform(
                                        multipart(
                                                        "/api/minigames/{id}/image-slots/activity-photo/uploads",
                                                        definition.getId())
                                                .session(teacher.session())
                                                .file(
                                                        new MockMultipartFile(
                                                                "file",
                                                                "original.png",
                                                                "image/png",
                                                                png)))
                                .andExpect(status().isCreated())
                                .andReturn());
        long second =
                idFrom(
                        mvc.perform(
                                        multipart(
                                                        "/api/minigames/{id}/image-slots/activity-photo/uploads",
                                                        definition.getId())
                                                .session(teacher.session())
                                                .file(
                                                        new MockMultipartFile(
                                                                "file",
                                                                "replacement.png",
                                                                "image/png",
                                                                png)))
                                .andExpect(status().isCreated())
                                .andReturn());
        var configuration =
                (tools.jackson.databind.node.ObjectNode)
                        definition.getDefaultConfiguration().deepCopy();
        configuration.put("imageAssetId", first);
        if (configuration.has("maxNumber")) {
            configuration.put("maxNumber", 73);
            configuration.put("exerciseCount", 37);
        }
        if (configuration.has("operations")) configuration.putArray("operations").add("*").add("/");
        if (configuration.has("animals")) {
            configuration.put("letter", "a");
            ((tools.jackson.databind.node.ObjectNode) configuration.get("animals").get(0))
                    .put("name", "Ana")
                    .put("imageAssetId", first);
        }
        if (configuration.has("pairs"))
            ((tools.jackson.databind.node.ObjectNode) configuration.get("pairs").get(0))
                    .put("number", 17)
                    .put("imageAssetId", first);
        String prefix =
                "{\"miniGameId\":" + definition.getId() + ",\"orderIndex\":0,\"configuration\":";
        long item =
                idFrom(
                        mvc.perform(
                                        post("/api/worksheets/{id}/items", worksheet)
                                                .session(teacher.session())
                                                .contentType("application/json")
                                                .content(prefix + configuration + "}"))
                                .andExpect(status().isCreated())
                                .andReturn());
        long attempt =
                idFrom(
                        mvc.perform(
                                        post("/api/worksheets/{id}/attempts", worksheet)
                                                .session(teacher.session()))
                                .andExpect(status().isCreated())
                                .andReturn());
        configuration.put("imageAssetId", second);
        for (String collection : new String[] {"animals", "pairs"})
            if (configuration.has(collection))
                ((tools.jackson.databind.node.ObjectNode) configuration.get(collection).get(0))
                        .putNull("imageAssetId");
        mvc.perform(
                        put("/api/worksheets/{id}/items/{item}", worksheet, item)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(prefix + configuration + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(item));
        mvc.perform(get("/api/worksheets/{id}", worksheet).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.items[0].configuration")
                                .value((Object) JsonPath.read(configuration.toString(), "$")));
        mvc.perform(get("/api/attempts/{id}", attempt).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].configuration.imageAssetId").value(first));
        mvc.perform(delete("/api/minigame-assets/{id}", first).session(teacher.session()))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/minigame-assets/{id}/content", first).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(content().bytes(png));
    }

    @Test
    void teachersCreateVersionedDefinitionsAndOwnershipIsolated() throws Exception {
        Account teacher = signupAdmin("Teacher", "dynamic.teacher@example.com");
        Account otherTeacher = signup("Other", "dynamic.other@example.com", "TEACHER");
        Account user = signup("User", "dynamic.user@example.com", "USER");

        mvc.perform(
                        post("/api/minigames")
                                .session(user.session())
                                .contentType("application/json")
                                .content(definitionBody(1)))
                .andExpect(status().isForbidden());

        MvcResult created = createDefinition(teacher, 1);
        Long id = idFrom(created);
        mvc.perform(
                        post("/api/minigames")
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(definitionBody(1)))
                .andExpect(status().isConflict());
        createDefinition(teacher, 2);

        mvc.perform(
                        put("/api/minigames/{id}", id)
                                .session(otherTeacher.session())
                                .contentType("application/json")
                                .content(updateBody()))
                .andExpect(status().isForbidden());
        mvc.perform(
                        put("/api/minigames/{id}", id)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(updateBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated game"));
        mvc.perform(get("/api/minigames"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void configurationAndResultPayloadsAreValidatedAndVersionsFreezeWhenUsed() throws Exception {
        Account teacher = signupAdmin("Teacher", "schema.teacher@example.com");
        Long definitionId = idFrom(createDefinition(teacher, 1));
        Long worksheetId = createWorksheet(teacher);

        mvc.perform(
                        post("/api/worksheets/{id}/items", worksheetId)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(
                                        "{\"miniGameId\":"
                                                + definitionId
                                                + ",\"orderIndex\":1,\"configuration\":{\"difficulty\":9}}"))
                .andExpect(status().isBadRequest());
        MvcResult item =
                mvc.perform(
                                post("/api/worksheets/{id}/items", worksheetId)
                                        .session(teacher.session())
                                        .contentType("application/json")
                                        .content(
                                                "{\"miniGameId\":"
                                                        + definitionId
                                                        + ",\"orderIndex\":1}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.configuration.difficulty").value(2))
                        .andReturn();
        Long itemId = idFrom(item);

        mvc.perform(
                        put("/api/minigames/{id}", definitionId)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(updateBody()))
                .andExpect(status().isConflict());

        Long resultId =
                idFrom(
                        mvc.perform(
                                        post("/api/worksheets/{id}/results", worksheetId)
                                                .session(teacher.session())
                                                .contentType("application/json")
                                                .content("{\"totalScore\":1,\"maxScore\":2}"))
                                .andExpect(status().isCreated())
                                .andReturn());
        mvc.perform(
                        post("/api/worksheet-results/{id}/mini-game-results", resultId)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(resultBody(itemId, "{}")))
                .andExpect(status().isBadRequest());
        mvc.perform(
                        post("/api/worksheet-results/{id}/mini-game-results", resultId)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(resultBody(itemId, "{\"moves\":4}")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.details.moves").value(4));
    }

    @Test
    void deactivationPreventsNewItemsButKeepsExistingItemsUsable() throws Exception {
        Account teacher = signupAdmin("Teacher", "inactive.teacher@example.com");
        Long definitionId = idFrom(createDefinition(teacher, 1));
        Long worksheetId = createWorksheet(teacher);
        mvc.perform(
                        post("/api/worksheets/{id}/items", worksheetId)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content("{\"miniGameId\":" + definitionId + ",\"orderIndex\":1}"))
                .andExpect(status().isCreated());

        mvc.perform(delete("/api/minigames/{id}", definitionId).session(teacher.session()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/minigames/{id}", definitionId)).andExpect(status().isNotFound());
        mvc.perform(
                        post("/api/worksheets/{id}/items", worksheetId)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content("{\"miniGameId\":" + definitionId + ",\"orderIndex\":2}"))
                .andExpect(status().isConflict());
    }

    @Test
    void genericAssetsAreTeacherOwnedAndAvailableToAuthenticatedPlayers() throws Exception {
        Account teacher = signupAdmin("Teacher", "asset.teacher@example.com");
        Account otherTeacher = signup("Other", "asset.other@example.com", "TEACHER");
        Account user = signup("User", "asset.user@example.com", "USER");
        byte[] audio = "ID3test-audio".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile("file", "sound.mp3", "audio/mpeg", audio);

        mvc.perform(multipart("/api/minigame-assets").file(file).session(user.session()))
                .andExpect(status().isForbidden());
        MvcResult uploaded =
                mvc.perform(multipart("/api/minigame-assets").file(file).session(teacher.session()))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.contentType").value("audio/mpeg"))
                        .andExpect(jsonPath("$.url").isNotEmpty())
                        .andReturn();
        Long assetId = idFrom(uploaded);

        mvc.perform(get("/api/minigame-assets/{id}/content", assetId).session(user.session()))
                .andExpect(status().isOk())
                .andExpect(content().bytes(audio));
        mvc.perform(delete("/api/minigame-assets/{id}", assetId).session(otherTeacher.session()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/minigame-assets/{id}", assetId).session(teacher.session()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/minigame-assets/{id}/content", assetId).session(user.session()))
                .andExpect(status().isNotFound());
    }

    private MvcResult createDefinition(Account teacher, int version) throws Exception {
        return mvc.perform(
                        post("/api/minigames")
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(definitionBody(version)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.version").value(version))
                .andExpect(jsonPath("$.defaultConfiguration.difficulty").value(2))
                .andReturn();
    }

    private String definitionBody(int version) {
        return "{\"name\":\"Dynamic game\",\"type\":\"match-pairs\",\"version\":"
                + version
                + ",\"configurationSchema\":"
                + CONFIG_SCHEMA
                + ",\"resultSchema\":"
                + RESULT_SCHEMA
                + ",\"defaultConfiguration\":{\"difficulty\":2}}";
    }

    private String updateBody() {
        return "{\"name\":\"Updated game\",\"configurationSchema\":"
                + CONFIG_SCHEMA
                + ",\"resultSchema\":"
                + RESULT_SCHEMA
                + ",\"defaultConfiguration\":{\"difficulty\":2}}";
    }

    private Long createWorksheet(Account account) throws Exception {
        return idFrom(
                mvc.perform(
                                post("/api/worksheets")
                                        .session(account.session())
                                        .contentType("application/json")
                                        .content("{\"name\":\"Dynamic worksheet\"}"))
                        .andExpect(status().isCreated())
                        .andReturn());
    }

    private String resultBody(Long itemId, String details) {
        return "{\"worksheetItemId\":"
                + itemId
                + ",\"score\":1,\"maxScore\":2,\"timeSeconds\":3,\"details\":"
                + details
                + "}";
    }

    private Account signup(String name, String email, String role) throws Exception {
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
                                                        + "\",\"password\":\"a long test"
                                                        + " password\",\"role\":\""
                                                        + role
                                                        + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        return new Account(
                (MockHttpSession) result.getRequest().getSession(false), idFrom(result), email);
    }

    private Account signupAdmin(String name, String email) throws Exception {
        Account account = signup(name, email, "USER");
        var user = users.findById(account.id()).orElseThrow();
        user.changeRole(UserRole.ADMIN);
        users.saveAndFlush(user);
        MvcResult login =
                mvc.perform(
                                post("/api/auth/login")
                                        .contentType("application/json")
                                        .content(
                                                "{\"email\":\""
                                                        + email
                                                        + "\",\"password\":\"a long test"
                                                        + " password\"}"))
                        .andExpect(status().isOk())
                        .andReturn();
        return new Account(
                (MockHttpSession) login.getRequest().getSession(false), account.id(), email);
    }

    private Long idFrom(MvcResult result) throws Exception {
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id"))
                .longValue();
    }

    private record Account(MockHttpSession session, Long id, String email) {}
}
