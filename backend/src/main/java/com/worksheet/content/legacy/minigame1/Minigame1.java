package com.worksheet.content.legacy.minigame1;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.time.Instant;

@Entity
public class Minigame1 {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String imageFilename;
    private String imageContentType;
    private Instant createdAt;

    protected Minigame1() {}

    public Minigame1(String name, String imageFilename, String imageContentType) {
        this.name = name;
        this.imageFilename = imageFilename;
        this.imageContentType = imageContentType;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getImageFilename() {
        return imageFilename;
    }

    public String getImageContentType() {
        return imageContentType;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
