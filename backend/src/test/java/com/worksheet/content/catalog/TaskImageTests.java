package com.worksheet.content.catalog;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import com.worksheet.auth.UserRepository;
import com.worksheet.auth.UserRole;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.Base64;
import java.util.UUID;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:task-image-test;DB_CLOSE_DELAY=-1",
            "spring.flyway.enabled=false",
            "spring.jpa.hibernate.ddl-auto=create-drop",
            "app.minigame-asset-directory=./target/task-image-test-assets"
        })
@AutoConfigureMockMvc
class TaskImageTests {
    private static final byte[] PNG =
            Base64.getDecoder()
                    .decode(
                            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=");
    private static final String UPLOAD_SLOT =
            """
            {"picture":{"path":"/tasks/*/imageAssetId","label":"Task picture","allowUpload":true}}
            """;
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired ObjectMapper mapper;

    @Test
    void teacherUploadsAndReusesRealImageInNestedTasks() throws Exception {
        Account admin = account(UserRole.ADMIN);
        Account teacher = account(UserRole.TEACHER);
        Account other = account(UserRole.TEACHER);
        long definition = definition(admin, UPLOAD_SLOT, "{}", "{\"tasks\":[]}");
        mvc.perform(get("/api/minigames/{id}/image-slots", definition).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].path").value("/tasks/*/imageAssetId"))
                .andExpect(jsonPath("$[0].allowUpload").value(true))
                .andExpect(jsonPath("$[0].acceptedContentTypes", hasSize(4)));
        long image =
                id(
                        upload(teacher, definition, "picture", image())
                                .andExpect(status().isCreated())
                                .andReturn());
        long worksheet = worksheet(teacher);
        String config =
                "{\"tasks\":[{\"imageAssetId\":" + image + "},{\"imageAssetId\":" + image + "}]}";
        save(teacher, worksheet, definition, config).andExpect(status().isCreated());
        mvc.perform(get("/api/worksheets/{id}/items", worksheet).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].configuration.tasks[1].imageAssetId").value(image));
        mvc.perform(get("/api/minigame-assets/{id}/content", image).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(PNG));
        mvc.perform(get("/api/minigame-assets").session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].id").value(image));
        mvc.perform(get("/api/minigame-assets").session(other.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
        save(other, worksheet(other), definition, config).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/minigame-assets/{id}", image).session(other.session()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/minigame-assets/{id}", image).session(teacher.session()))
                .andExpect(status().isConflict());
    }

    @Test
    void slotsOptInAndOnlyTeachersAndAdminsUploadImages() throws Exception {
        Account admin = account(UserRole.ADMIN);
        Account teacher = account(UserRole.TEACHER);
        Account player = account(UserRole.USER);
        long plain = definition(admin, "{}", "{}", "{\"tasks\":[]}");
        mvc.perform(get("/api/minigames/{id}/image-slots", plain).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        upload(teacher, plain, "picture", image()).andExpect(status().isNotFound());
        long enabled = definition(admin, UPLOAD_SLOT, "{}", "{\"tasks\":[]}");
        upload(player, enabled, "picture", image()).andExpect(status().isForbidden());
        mvc.perform(
                        multipart("/api/minigames/{id}/image-slots/picture/uploads", enabled)
                                .file(image()))
                .andExpect(status().isUnauthorized());
        upload(teacher, enabled, "missing", image()).andExpect(status().isNotFound());
        upload(
                        teacher,
                        enabled,
                        "picture",
                        new MockMultipartFile(
                                "file", "fake.png", "image/png", "ID3audio".getBytes()))
                .andExpect(status().isBadRequest());
        upload(
                        teacher,
                        enabled,
                        "picture",
                        new MockMultipartFile("file", "empty.png", "image/png", new byte[0]))
                .andExpect(status().isBadRequest());
        upload(
                        teacher,
                        enabled,
                        "picture",
                        new MockMultipartFile(
                                "file", "large.png", "image/png", new byte[10 * 1024 * 1024 + 1]))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/minigames/{id}", enabled).session(admin.session()))
                .andExpect(status().isNoContent());
        upload(teacher, enabled, "picture", image()).andExpect(status().isNotFound());
        // Existing games retain the same ordinary configuration/save API.
        save(teacher, worksheet(teacher), plain, "{\"tasks\":[{}]}")
                .andExpect(status().isCreated());
    }

    @Test
    void teachersSelectAllowedCatalogVariantsAndCannotBypassChoiceOnlySlots() throws Exception {
        Account admin = account(UserRole.ADMIN);
        Account teacher = account(UserRole.TEACHER);
        long apple =
                id(
                        mvc.perform(
                                        multipart("/api/minigame-assets")
                                                .file(image())
                                                .session(admin.session()))
                                .andExpect(status().isCreated())
                                .andReturn());
        long cat =
                id(
                        mvc.perform(
                                        multipart("/api/minigame-assets")
                                                .file(image())
                                                .session(admin.session()))
                                .andExpect(status().isCreated())
                                .andReturn());
        String choices =
                "{\"picture\":{\"path\":\"/tasks/*/imageAssetId\",\"variants\":[\"apple\",\"cat\"]}}";
        long definition =
                definition(
                        admin,
                        choices,
                        "{\"apple\":" + apple + ",\"cat\":" + cat + "}",
                        configuration(apple));
        mvc.perform(get("/api/minigames/{id}/image-slots", definition).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].variants", hasSize(2)))
                .andExpect(jsonPath("$[0].variants[0].assetId").value(apple))
                .andExpect(jsonPath("$[0].allowUpload").value(false));
        long worksheet = worksheet(teacher);
        save(teacher, worksheet, definition, configuration(cat)).andExpect(status().isCreated());
        // Omitted configuration uses the catalog default, never the admin's private upload.
        mvc.perform(
                        post("/api/worksheets/{id}/items", worksheet)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content("{\"miniGameId\":" + definition + ",\"orderIndex\":2}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.configuration.tasks[0].imageAssetId").value(apple));
        upload(teacher, definition, "picture", image()).andExpect(status().isForbidden());
        long uploads = definition(admin, UPLOAD_SLOT, "{}", "{\"tasks\":[]}");
        long own =
                id(
                        upload(teacher, uploads, "picture", image())
                                .andExpect(status().isCreated())
                                .andReturn());
        save(teacher, worksheet, definition, configuration(own)).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/minigame-assets/{id}", apple).session(admin.session()))
                .andExpect(status().isConflict());
    }

    @Test
    void rejectsInvalidMissingDeletedAndNonImageReferences() throws Exception {
        Account admin = account(UserRole.ADMIN);
        Account teacher = account(UserRole.TEACHER);
        long definition = definition(admin, UPLOAD_SLOT, "{}", "{\"tasks\":[]}");
        long worksheet = worksheet(teacher);
        save(teacher, worksheet, definition, "{\"tasks\":[{\"imageAssetId\":\"12\"}]}")
                .andExpect(status().isBadRequest());
        save(teacher, worksheet, definition, configuration(-1)).andExpect(status().isBadRequest());
        save(teacher, worksheet, definition, configuration(Long.MAX_VALUE))
                .andExpect(status().isNotFound());
        long audio =
                id(
                        mvc.perform(
                                        multipart("/api/minigame-assets")
                                                .session(admin.session())
                                                .file(
                                                        new MockMultipartFile(
                                                                "file",
                                                                "audio.mp3",
                                                                "audio/mpeg",
                                                                "ID3audio".getBytes())))
                                .andExpect(status().isCreated())
                                .andReturn());
        save(admin, worksheet(admin), definition, configuration(audio))
                .andExpect(status().isBadRequest());
        long image =
                id(
                        upload(teacher, definition, "picture", image())
                                .andExpect(status().isCreated())
                                .andReturn());
        mvc.perform(delete("/api/minigame-assets/{id}", image).session(teacher.session()))
                .andExpect(status().isNoContent());
        save(teacher, worksheet, definition, configuration(image)).andExpect(status().isNotFound());
        mvc.perform(get("/api/minigame-assets/{id}/content", image).session(teacher.session()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/minigame-assets").session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void replacingAndRemovingDraftImagesReleasesReferences() throws Exception {
        Account admin = account(UserRole.ADMIN);
        Account teacher = account(UserRole.TEACHER);
        long definition = definition(admin, UPLOAD_SLOT, "{}", "{\"tasks\":[]}");
        long first =
                id(
                        upload(teacher, definition, "picture", image())
                                .andExpect(status().isCreated())
                                .andReturn());
        long second =
                id(
                        upload(teacher, definition, "picture", image())
                                .andExpect(status().isCreated())
                                .andReturn());
        long worksheet = worksheet(teacher);
        long item =
                id(
                        save(teacher, worksheet, definition, configuration(first))
                                .andExpect(status().isCreated())
                                .andReturn());
        mvc.perform(
                        put("/api/worksheets/{worksheet}/items/{item}", worksheet, item)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(itemBody(definition, configuration(second))))
                .andExpect(status().isOk());
        mvc.perform(delete("/api/minigame-assets/{id}", first).session(teacher.session()))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/minigame-assets/{id}", second).session(teacher.session()))
                .andExpect(status().isConflict());
        mvc.perform(
                        delete("/api/worksheets/{worksheet}/items/{item}", worksheet, item)
                                .session(teacher.session()))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/minigame-assets/{id}", second).session(teacher.session()))
                .andExpect(status().isNoContent());
    }

    @Test
    void publishedRevisionKeepsImageAfterDraftChangesAndDeletion() throws Exception {
        Account admin = account(UserRole.ADMIN);
        Account teacher = account(UserRole.TEACHER);
        long definition = definition(admin, UPLOAD_SLOT, "{}", "{\"tasks\":[]}");
        long image =
                id(
                        upload(teacher, definition, "picture", image())
                                .andExpect(status().isCreated())
                                .andReturn());
        long worksheet = worksheet(teacher);
        long item =
                id(
                        save(teacher, worksheet, definition, configuration(image))
                                .andExpect(status().isCreated())
                                .andReturn());
        long attempt =
                id(
                        mvc.perform(
                                        post("/api/worksheets/{id}/attempts", worksheet)
                                                .session(teacher.session()))
                                .andExpect(status().isCreated())
                                .andReturn());
        mvc.perform(
                        put("/api/worksheets/{worksheet}/items/{item}", worksheet, item)
                                .session(teacher.session())
                                .contentType("application/json")
                                .content(itemBody(definition, "{\"tasks\":[]}")))
                .andExpect(status().isOk());
        mvc.perform(
                        delete("/api/worksheets/{worksheet}/items/{item}", worksheet, item)
                                .session(teacher.session()))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/minigame-assets/{id}", image).session(teacher.session()))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/minigame-assets/{id}", image).session(admin.session()))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/attempts/{id}", attempt).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].configuration.tasks[0].imageAssetId").value(image));
        mvc.perform(get("/api/minigame-assets/{id}/content", image).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(content().bytes(PNG));
    }

    @Test
    void rejectsMalformedPoliciesUnavailableVariantsAndPrivateDefaults() throws Exception {
        Account admin = account(UserRole.ADMIN);
        for (String slots :
                new String[] {
                    "[]",
                    "{\"picture\":{\"path\":\"tasks/image\",\"allowUpload\":true}}",
                    "{\"picture\":{\"path\":\"/image\",\"allowUpload\":\"yes\"}}",
                    "{\"picture\":{\"path\":\"/image\"}}",
                    "{\"picture\":{\"path\":\"/image\",\"allowUpload\":true,\"typo\":true}}",
                    "{\"picture\":{\"path\":\"/image\",\"variants\":[\"missing\"]}}"
                }) {
            createDefinition(admin, slots, "{}", "{\"tasks\":[]}")
                    .andExpect(status().isBadRequest());
        }
        long image =
                id(
                        mvc.perform(
                                        multipart("/api/minigame-assets")
                                                .file(image())
                                                .session(admin.session()))
                                .andExpect(status().isCreated())
                                .andReturn());
        createDefinition(admin, UPLOAD_SLOT, "{}", configuration(image))
                .andExpect(status().isBadRequest());
        long audio =
                id(
                        mvc.perform(
                                        multipart("/api/minigame-assets")
                                                .session(admin.session())
                                                .file(
                                                        new MockMultipartFile(
                                                                "file",
                                                                "sound.mp3",
                                                                "audio/mpeg",
                                                                "ID3audio".getBytes())))
                                .andExpect(status().isCreated())
                                .andReturn());
        createDefinition(
                        admin,
                        "{\"picture\":{\"path\":\"/image\",\"variants\":[\"sound\"]}}",
                        "{\"sound\":" + audio + "}",
                        "{\"tasks\":[]}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void imageArraysAndMixedUploadChoiceSlotsAreSupportedWithoutGameSpecificCode()
            throws Exception {
        Account admin = account(UserRole.ADMIN);
        Account teacher = account(UserRole.TEACHER);
        long catalog =
                id(
                        mvc.perform(
                                        multipart("/api/minigame-assets")
                                                .file(image())
                                                .session(admin.session()))
                                .andExpect(status().isCreated())
                                .andReturn());
        String slots =
                "{\"picture\":{\"path\":\"/tasks/*/variants/*/imageAssetId\",\"allowUpload\":true,\"variants\":[\"cat\"]}}";
        long definition = definition(admin, slots, "{\"cat\":" + catalog + "}", "{\"tasks\":[]}");
        long own =
                id(
                        upload(teacher, definition, "picture", image())
                                .andExpect(status().isCreated())
                                .andReturn());
        String configuration =
                "{\"tasks\":[{\"variants\":[{\"imageAssetId\":"
                        + own
                        + "},{\"imageAssetId\":"
                        + catalog
                        + "}]}]}";
        save(teacher, worksheet(teacher), definition, configuration)
                .andExpect(status().isCreated());
    }

    @Test
    void catalogSlotsCanBeUpdatedBeforeUseAndThumbnailsCannotBeDeleted() throws Exception {
        Account admin = account(UserRole.ADMIN);
        Account teacher = account(UserRole.TEACHER);
        long image =
                id(
                        mvc.perform(
                                        multipart("/api/minigame-assets")
                                                .file(image())
                                                .session(admin.session()))
                                .andExpect(status().isCreated())
                                .andReturn());
        String choices =
                "{\"picture\":{\"path\":\"/tasks/*/imageAssetId\",\"variants\":[\"cat\"]}}";
        long definition = definition(admin, choices, "{\"cat\":" + image + "}", "{\"tasks\":[]}");
        String body =
                "{\"name\":\"Updated\",\"configurationSchema\":{\"x-image-slots\":"
                        + choices
                        + "},\"defaultConfiguration\":{},\"assets\":{\"cat\":"
                        + image
                        + "}}";
        mvc.perform(
                        put("/api/minigames/{id}", definition)
                                .session(admin.session())
                                .contentType("application/json")
                                .content(body))
                .andExpect(status().isOk());
        mvc.perform(get("/api/minigames/{id}/image-slots", definition).session(teacher.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].variants[0].assetId").value(image));
        // Swap the catalog reference for a thumbnail reference on the same unused definition.
        mvc.perform(
                        put("/api/minigames/{id}", definition)
                                .session(admin.session())
                                .contentType("application/json")
                                .content(
                                        "{\"name\":\"Thumbnail\",\"thumbnailAssetId\":"
                                                + image
                                                + "}"))
                .andExpect(status().isOk());
        mvc.perform(delete("/api/minigame-assets/{id}", image).session(admin.session()))
                .andExpect(status().isConflict());
    }

    private MockMultipartFile image() {
        return new MockMultipartFile("file", "picture.png", "application/octet-stream", PNG);
    }

    private ResultActions upload(
            Account account, long definition, String slot, MockMultipartFile file)
            throws Exception {
        return mvc.perform(
                multipart("/api/minigames/{id}/image-slots/{slot}/uploads", definition, slot)
                        .file(file)
                        .session(account.session()));
    }

    private String configuration(long image) {
        return "{\"tasks\":[{\"imageAssetId\":" + image + "}]}";
    }

    private String itemBody(long definition, String configuration) {
        return "{\"miniGameId\":"
                + definition
                + ",\"orderIndex\":1,\"configuration\":"
                + configuration
                + "}";
    }

    private ResultActions save(
            Account account, long worksheet, long definition, String configuration)
            throws Exception {
        return mvc.perform(
                post("/api/worksheets/{id}/items", worksheet)
                        .session(account.session())
                        .contentType("application/json")
                        .content(itemBody(definition, configuration)));
    }

    private long definition(Account admin, String slots, String assets, String defaults)
            throws Exception {
        return id(
                createDefinition(admin, slots, assets, defaults)
                        .andExpect(status().isCreated())
                        .andReturn());
    }

    private ResultActions createDefinition(
            Account admin, String slots, String assets, String defaults) throws Exception {
        ObjectNode schema = mapper.createObjectNode().put("type", "object");
        schema.set("x-image-slots", mapper.readTree(slots));
        schema.set(
                "properties",
                mapper.readTree(
                        "{\"tasks\":{\"type\":\"array\",\"maxItems\":10,\"items\":{\"type\":\"object\"}}}"));
        ObjectNode body =
                mapper.createObjectNode()
                        .put("name", "Task images")
                        .put("type", "images-" + UUID.randomUUID());
        body.set("configurationSchema", schema);
        body.set("assets", mapper.readTree(assets));
        body.set("defaultConfiguration", mapper.readTree(defaults));
        return mvc.perform(
                post("/api/minigames")
                        .session(admin.session())
                        .contentType("application/json")
                        .content(body.toString()));
    }

    private long worksheet(Account teacher) throws Exception {
        return id(
                mvc.perform(
                                post("/api/worksheets")
                                        .session(teacher.session())
                                        .contentType("application/json")
                                        .content("{\"name\":\"Image tasks\"}"))
                        .andExpect(status().isCreated())
                        .andReturn());
    }

    private Account account(UserRole role) throws Exception {
        String email = UUID.randomUUID() + "@images.test";
        MvcResult signup =
                mvc.perform(
                                post("/api/auth/signup")
                                        .header("X-Auth-Request", "1")
                                        .contentType("application/json")
                                        .content(
                                                "{\"name\":\"Test\",\"email\":\""
                                                        + email
                                                        + "\",\"password\":\"a long test"
                                                        + " password\",\"role\":\""
                                                        + (role == UserRole.ADMIN ? "USER" : role)
                                                        + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn();
        if (role != UserRole.ADMIN)
            return new Account((MockHttpSession) signup.getRequest().getSession(false));
        var user = users.findById(id(signup)).orElseThrow();
        user.changeRole(role);
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
        return new Account((MockHttpSession) login.getRequest().getSession(false));
    }

    private long id(MvcResult result) throws Exception {
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id"))
                .longValue();
    }

    private record Account(MockHttpSession session) {}
}
