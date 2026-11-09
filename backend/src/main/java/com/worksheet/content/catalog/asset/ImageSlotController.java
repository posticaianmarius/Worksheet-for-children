package com.worksheet.content.catalog.asset;

import com.worksheet.auth.AuthSessionService;
import com.worksheet.auth.User;
import com.worksheet.auth.UserRole;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/minigames/{definitionId}/image-slots")
public class ImageSlotController {
    private final ImageSlotService service;
    private final AuthSessionService auth;

    public ImageSlotController(ImageSlotService service, AuthSessionService auth) {
        this.service = service;
        this.auth = auth;
    }

    @GetMapping
    public List<ImageSlotService.SlotResponse> describe(
            @PathVariable Long definitionId, HttpServletRequest request) {
        auth.requireUserId(request);
        return service.describe(definitionId);
    }

    @PostMapping(value = "/{slotKey}/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public MiniGameAssetResponse upload(
            @PathVariable Long definitionId,
            @PathVariable String slotKey,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request) {
        User user = auth.requireUser(request);
        if (user.getRole() != UserRole.TEACHER && user.getRole() != UserRole.ADMIN) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Only teachers and admins can upload task images.");
        }
        return service.upload(definitionId, slotKey, user, file);
    }
}
