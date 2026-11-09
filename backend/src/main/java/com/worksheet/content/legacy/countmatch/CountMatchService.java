package com.worksheet.content.legacy.countmatch;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

@Service
public class CountMatchService {

    private static final List<String> CATEGORIES =
            List.of("animals", "fruits", "shapes", "toys", "vegetables");
    private final Path imageDirectory;

    public CountMatchService(@Value("${app.count-match.image-directory}") String imageDirectory) {
        this.imageDirectory = Path.of(imageDirectory).toAbsolutePath().normalize();
    }

    public List<String> categories() {
        return CATEGORIES;
    }

    public List<String> images(String category, int count) {
        Path directory = categoryDirectory(category);
        if (count < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Count must be at least 1.");
        }
        try (var files = Files.list(directory)) {
            var filenames =
                    new ArrayList<>(
                            files.filter(Files::isRegularFile)
                                    .filter(path -> isPng(path.getFileName().toString()))
                                    .map(path -> path.getFileName().toString())
                                    .toList());
            if (count > filenames.size()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Count exceeds the available images: " + filenames.size() + ".");
            }
            Collections.shuffle(filenames);
            return filenames.stream()
                    .limit(count)
                    .map(
                            filename ->
                                    "/api/count-match/images/"
                                            + category
                                            + "/"
                                            + UriUtils.encodePathSegment(
                                                    filename, StandardCharsets.UTF_8))
                    .toList();
        } catch (IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not read Count & Match images.",
                    exception);
        }
    }

    public Resource image(String category, String filename) {
        Path directory = categoryDirectory(category);
        if (filename.contains("/") || filename.contains("\\") || !isPng(filename)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found.");
        }
        Path file = directory.resolve(filename).normalize();
        if (!file.startsWith(directory) || !Files.isRegularFile(file) || !Files.isReadable(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found.");
        }
        return new FileSystemResource(file);
    }

    private Path categoryDirectory(String category) {
        if (!CATEGORIES.contains(category)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Unknown Count & Match category.");
        }
        String folder = category.substring(0, 1).toUpperCase(Locale.ROOT) + category.substring(1);
        return imageDirectory.resolve(folder);
    }

    private boolean isPng(String filename) {
        return filename.toLowerCase(Locale.ROOT).endsWith(".png");
    }
}
