package com.worksheet.teaching.classroom;

import com.worksheet.auth.User;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "classroom")
public class Classroom {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "space_id")
    private Long spaceId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "join_code", nullable = false, unique = true, length = 12)
    private String joinCode;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    protected Classroom() {}

    public Classroom(User teacher, String name, String joinCode) {
        this.teacher = teacher;
        this.name = name;
        this.joinCode = joinCode;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getSpaceId() {
        return spaceId;
    }

    public void setSpaceId(Long value) {
        spaceId = value;
    }

    public void setTeacher(User value) {
        teacher = value;
    }

    public User getTeacher() {
        return teacher;
    }

    public String getName() {
        return name;
    }

    public String getJoinCode() {
        return joinCode;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getArchivedAt() {
        return archivedAt;
    }

    public void archive() {
        if (archivedAt == null) archivedAt = Instant.now();
    }

    public long getRowVersion() {
        return rowVersion;
    }

    public void rotateJoinCode(String joinCode) {
        this.joinCode = joinCode;
    }
}
