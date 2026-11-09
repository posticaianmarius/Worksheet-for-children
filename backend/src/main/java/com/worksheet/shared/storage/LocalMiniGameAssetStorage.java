package com.worksheet.shared.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
public class LocalMiniGameAssetStorage implements MiniGameAssetStorage {
    private final Path directory;

    public LocalMiniGameAssetStorage(@Value("${app.minigame-asset-directory}") String directory) {
        this.directory = Path.of(directory).toAbsolutePath().normalize();
    }

    @Override
    public void store(String storageKey, byte[] content) {
        try {
            Files.createDirectories(directory);
            Files.write(resolve(storageKey), content);
        } catch (IOException error) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "Could not store mini-game asset.", error);
        }
    }

    @Override
    public byte[] load(String storageKey) {
        try {
            return Files.readAllBytes(resolve(storageKey));
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Asset file not found.");
        }
    }

    @Override
    public void delete(String storageKey) {
        try {
            Files.deleteIfExists(resolve(storageKey));
        } catch (IOException error) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not delete mini-game asset file.",
                    error);
        }
    }

    private Path resolve(String storageKey) {
        Path path = directory.resolve(storageKey).normalize();
        if (!path.startsWith(directory)) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "Invalid asset storage path.");
        }
        return path;
    }
}
