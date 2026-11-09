package com.worksheet.content.legacy.minigame1;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class Minigame1Service {

    private final Minigame1Repository minigame1Repository;
    private final ImageStorageService imageStorageService;

    public Minigame1Service(
            Minigame1Repository minigame1Repository, ImageStorageService imageStorageService) {
        this.minigame1Repository = minigame1Repository;
        this.imageStorageService = imageStorageService;
    }

    public Minigame1Response create(String name, MultipartFile image) {
        String cleanName = name == null ? "" : name.trim();
        if (cleanName.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Animal name is required.");
        }

        String filename = imageStorageService.store(image);
        try {
            Minigame1 minigame1 =
                    minigame1Repository.save(
                            new Minigame1(cleanName, filename, image.getContentType()));
            return Minigame1Response.from(minigame1);
        } catch (RuntimeException exception) {
            imageStorageService.delete(filename);
            throw exception;
        }
    }

    public List<Minigame1Response> findAll() {
        return minigame1Repository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                .map(Minigame1Response::from)
                .toList();
    }

    public Minigame1 findById(Long id) {
        return minigame1Repository
                .findById(id)
                .orElseThrow(
                        () ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND, "Minigame1 entry not found."));
    }
}
