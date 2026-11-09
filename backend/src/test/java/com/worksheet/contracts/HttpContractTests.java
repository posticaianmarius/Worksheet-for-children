package com.worksheet.contracts;

import java.nio.charset.StandardCharsets;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** The public HTTP surface is independent of controller package ownership. */
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:http-contracts;DB_CLOSE_DELAY=-1",
    "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"
})
class HttpContractTests {
    @Autowired @Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping mappings;

    @Test void publicRoutesRemainCompatible() throws Exception {
        var actual = new TreeSet<String>();
        mappings.getHandlerMethods().forEach((mapping, handler) -> {
            for (String path : mapping.getPatternValues()) {
                if (path.startsWith("/api/")) {
                    mapping.getMethodsCondition().getMethods().forEach(method -> actual.add(method + " " + path));
                }
            }
        });
        try (var input = getClass().getResourceAsStream("/contracts/http-routes.txt")) {
            assertEquals(new String(input.readAllBytes(), StandardCharsets.UTF_8).strip(), String.join("\n", actual));
        }
    }
}
