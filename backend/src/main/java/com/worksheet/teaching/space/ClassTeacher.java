package com.worksheet.teaching.space;

import jakarta.persistence.*;

@Entity
@Table(
        name = "class_teacher",
        uniqueConstraints = @UniqueConstraint(columnNames = {"classroom_id", "user_id"}))
public class ClassTeacher {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "classroom_id")
    Long classroomId;

    @Column(name = "user_id")
    Long userId;

    public ClassTeacher() {}

    public Long getId() {
        return id;
    }

    public Long getClassroomId() {
        return classroomId;
    }

    public Long getUserId() {
        return userId;
    }
}
