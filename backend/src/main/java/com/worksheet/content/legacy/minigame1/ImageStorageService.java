package com.worksheet.content.legacy.minigame1;

import jakarta.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.UUID;

@Service
public class ImageStorageService {

    private final Path uploadDirectory;

    public ImageStorageService(@Value("${app.upload-directory}") String uploadDirectory) {
        this.uploadDirectory = Path.of(uploadDirectory).toAbsolutePath().normalize();
    }

    @PostConstruct
    void createUploadDirectory() throws IOException {
        Files.createDirectories(uploadDirectory);
    }

    public String store(MultipartFile image) {
        if (image.isEmpty()
                || image.getContentType() == null
                || !image.getContentType().toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Please upload an image file.");
        }

        String extension = getExtension(image.getOriginalFilename());
        String filename = UUID.randomUUID() + extension;
        Path destination = uploadDirectory.resolve(filename);

        try (InputStream input = image.getInputStream()) {
            Files.copy(input, destination);
            return filename;
        } catch (IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "Could not save the image.");
        }
    }

    public Resource load(String filename) {
        try {
            Resource resource = new UrlResource(uploadDirectory.resolve(filename).toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found.");
            }
            return resource;
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found.");
        }
    }

    public void delete(String filename) {
        try {
            Files.deleteIfExists(uploadDirectory.resolve(filename));
        } catch (IOException ignored) {
            // The database error that caused cleanup is more useful to the caller.
        }
    }

    private String getExtension(String originalFilename) {
        if (originalFilename == null) {
            return "";
        }
        int dot = originalFilename.lastIndexOf('.');
        if (dot < 0 || dot == originalFilename.length() - 1) {
            return "";
        }
        String extension = originalFilename.substring(dot).toLowerCase(Locale.ROOT);
        return extension.matches("\\.[a-z0-9]{1,10}") ? extension : "";
    }
}
