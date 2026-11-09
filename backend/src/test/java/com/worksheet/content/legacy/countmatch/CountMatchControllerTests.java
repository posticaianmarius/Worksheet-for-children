package com.worksheet.content.legacy.countmatch;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;

class CountMatchControllerTests {

    @TempDir Path directory;
    private CountMatchService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        service = new CountMatchService(directory.toString());
        mvc = MockMvcBuilders.standaloneSetup(new CountMatchController(service)).build();
    }

    @Test
    void listsCategoriesAndServesTheirImages() throws Exception {
        mvc.perform(get("/api/count-match/categories"))
                .andExpect(status().isOk())
                .andExpect(
                        content()
                                .json(
                                        "[\"animals\",\"fruits\",\"shapes\",\"toys\",\"vegetables\"]"));

        for (String category : service.categories()) {
            Path folder =
                    Files.createDirectory(
                            directory.resolve(
                                    category.substring(0, 1).toUpperCase(java.util.Locale.ROOT)
                                            + category.substring(1)));
            byte[] bytes = {1, 2, 3, 4};
            Files.write(folder.resolve("b.png"), bytes);
            Files.write(folder.resolve("a.png"), bytes);
            Files.writeString(folder.resolve("notes.txt"), "not an image");
            Files.createDirectory(folder.resolve("folder.png"));

            String imageUrl = "/api/count-match/images/" + category + "/a.png";
            mvc.perform(
                            get("/api/count-match/images")
                                    .param("category", category)
                                    .param("count", "2"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(
                            jsonPath(
                                    "$",
                                    containsInAnyOrder(
                                            imageUrl,
                                            "/api/count-match/images/" + category + "/b.png")));
            mvc.perform(get(imageUrl))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType("image/png"))
                    .andExpect(content().bytes(bytes));
        }
    }

    @Test
    void returnsRequestedNumberOfDistinctImages() throws Exception {
        Path folder = Files.createDirectory(directory.resolve("Vegetables"));
        for (int i = 0; i < 16; i++) {
            Files.write(folder.resolve(i + ".png"), new byte[] {1});
        }
        mvc.perform(
                        get("/api/count-match/images")
                                .param("category", "vegetables")
                                .param("count", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(5));
        var images = service.images("vegetables", 5);
        assertEquals(5, images.stream().distinct().count());
        for (String url : images) {
            assertTrue(url.startsWith("/api/count-match/images/vegetables/"));
            assertTrue(
                    service.image("vegetables", url.substring(url.lastIndexOf('/') + 1)).exists());
        }
        assertEquals(1, service.images("vegetables", 1).size());
        for (String count : new String[] {"0", "-1", "17", "abc", "1.5"}) {
            mvc.perform(
                            get("/api/count-match/images")
                                    .param("category", "vegetables")
                                    .param("count", count))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void rejectsInvalidRequestsAndMissingImages() throws Exception {
        mvc.perform(get("/api/count-match/images")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/count-match/images").param("category", "fruits"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/count-match/images").param("count", "1"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/count-match/images").param("category", "unknown").param("count", "1"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/count-match/images/fruits/missing.png"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/count-match/images/fruits/notes.txt"))
                .andExpect(status().isNotFound());
        assertThrows(
                ResponseStatusException.class, () -> service.image("fruits", "../outside.png"));
        assertThrows(
                ResponseStatusException.class, () -> service.image("fruits", "..\\outside.png"));
    }
}
