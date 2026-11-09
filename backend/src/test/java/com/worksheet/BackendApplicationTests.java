package com.worksheet;

import static org.hamcrest.Matchers.endsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.worksheet.content.legacy.minigame1.Minigame1Repository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:animal-test;DB_CLOSE_DELAY=-1",
            "spring.flyway.enabled=false",
            "spring.jpa.hibernate.ddl-auto=create-drop",
            "app.upload-directory=./target/test-uploads"
        })
class BackendApplicationTests {

    @Autowired private MockMvc mockMvc;

    @Autowired private Minigame1Repository minigame1Repository;

    @Test
    void savesListsAndReturnsAnAnimalImage() throws Exception {
        minigame1Repository.deleteAll();
        MockMultipartFile image =
                new MockMultipartFile("image", "cat.png", "image/png", new byte[] {1, 2, 3, 4});

        String response =
                mockMvc.perform(multipart("/api/minigame1").file(image).param("name", "Cat"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.name").value("Cat"))
                        .andExpect(jsonPath("$.imageUrl", endsWith("/image")))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();

        String id = response.replaceAll(".*\\\"id\\\":(\\d+).*", "$1");

        mockMvc.perform(get("/api/minigame1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Cat"));

        mockMvc.perform(get("/api/minigame1/{id}/image", id))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(new byte[] {1, 2, 3, 4}));
    }
}
