package com.worksheet.teaching.space;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "teaching_space")
public class TeachingSpace {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "personal_owner_id", unique = true)
    Long personalOwnerId;

    @Column(name = "name")
    String name;

    @Column(name = "created_at")
    Instant createdAt;

    public TeachingSpace() {}

    public Long getId() {
        return id;
    }

    public Long getPersonalOwnerId() {
        return personalOwnerId;
    }

    public String getName() {
        return name;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
