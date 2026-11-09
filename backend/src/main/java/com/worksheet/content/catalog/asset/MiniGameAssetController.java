package com.worksheet.content.catalog.asset;

import com.worksheet.auth.AuthSessionService;
import com.worksheet.auth.User;
import com.worksheet.auth.UserRole;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/minigame-assets")
public class MiniGameAssetController {
    private final MiniGameAssetService service;
    private final AuthSessionService auth;

    public MiniGameAssetController(MiniGameAssetService service, AuthSessionService auth) {
        this.service = service;
        this.auth = auth;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public MiniGameAssetResponse upload(
            @RequestParam("file") MultipartFile file, HttpServletRequest request) {
        User admin = auth.requireRole(request, UserRole.ADMIN);
        return service.store(admin, file);
    }

    @GetMapping("/{id}/content")
    public ResponseEntity<byte[]> content(@PathVariable Long id, HttpServletRequest request) {
        auth.requireUserId(request);
        MiniGameAssetContent content = service.load(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.contentType()))
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline()
                                .filename(content.originalFilename())
                                .build()
                                .toString())
                .body(content.bytes());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, HttpServletRequest request) {
        service.delete(id, requireCreator(request));
    }

    @GetMapping
    public MiniGameAssetService.ImagePage myImages(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        return service.listImages(requireCreator(request).getId(), page, size);
    }

    private User requireCreator(HttpServletRequest request) {
        User user = auth.requireUser(request);
        if (user.getRole() != UserRole.TEACHER && user.getRole() != UserRole.ADMIN) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Only teachers and admins can manage task images.");
        }
        return user;
    }
}
