package com.worksheet.content.legacy.minigame1;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/minigame1")
public class Minigame1Controller {

    private final Minigame1Service minigame1Service;
    private final ImageStorageService imageStorageService;

    public Minigame1Controller(
            Minigame1Service minigame1Service, ImageStorageService imageStorageService) {
        this.minigame1Service = minigame1Service;
        this.imageStorageService = imageStorageService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Minigame1Response> create(
            @RequestParam String name, @RequestParam MultipartFile image) {
        return ResponseEntity.status(201).body(minigame1Service.create(name, image));
    }

    @GetMapping
    public List<Minigame1Response> findAll() {
        return minigame1Service.findAll();
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<Resource> getImage(@PathVariable Long id) {
        Minigame1 minigame1 = minigame1Service.findById(id);
        Resource image = imageStorageService.load(minigame1.getImageFilename());

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(minigame1.getImageContentType()))
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + minigame1.getImageFilename() + "\"")
                .body(image);
    }
}
