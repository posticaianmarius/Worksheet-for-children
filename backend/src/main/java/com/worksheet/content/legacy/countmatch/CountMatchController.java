package com.worksheet.content.legacy.countmatch;

import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/count-match")
public class CountMatchController {

    private final CountMatchService service;

    public CountMatchController(CountMatchService service) {
        this.service = service;
    }

    @GetMapping("/categories")
    public List<String> categories() {
        return service.categories();
    }

    @GetMapping("/images")
    public List<String> images(@RequestParam String category, @RequestParam int count) {
        return service.images(category, count);
    }

    @GetMapping("/images/{category}/{filename}")
    public ResponseEntity<Resource> image(
            @PathVariable String category, @PathVariable String filename) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(service.image(category, filename));
    }
}
