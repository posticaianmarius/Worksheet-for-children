package com.worksheet.teaching.classroom;

import com.worksheet.auth.User;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(
        name = "classroom_member",
        uniqueConstraints = @UniqueConstraint(columnNames = {"classroom_id", "user_id"}))
public class ClassroomMember {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id")
    private Long studentId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    @Column(name = "left_at")
    private Instant leftAt;

    @Column(name = "student_code", unique = true, length = 8)
    private String studentCode;

    protected ClassroomMember() {}

    public ClassroomMember(Classroom classroom, User user) {
        this.classroom = classroom;
        this.user = user;
        this.joinedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getStudentId() {
        return studentId;
    }

    public void setStudentId(Long value) {
        studentId = value;
    }

    public Classroom getClassroom() {
        return classroom;
    }

    public User getUser() {
        return user;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }

    public Instant getLeftAt() {
        return leftAt;
    }

    public String getStudentCode() {
        return studentCode;
    }

    public void setStudentCode(String studentCode) {
        this.studentCode = studentCode;
    }

    public void rejoin() {
        this.joinedAt = Instant.now();
        this.leftAt = null;
    }

    public void leave() {
        this.leftAt = Instant.now();
    }
}
