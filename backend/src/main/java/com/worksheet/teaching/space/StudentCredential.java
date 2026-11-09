package com.worksheet.teaching.space;

import jakarta.persistence.*;

@Entity
@Table(name = "student_credential")
public class StudentCredential {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "student_id")
    Long studentId;

    @Column(name = "code", unique = true, length = 8)
    String code;

    @Column(name = "primary_code")
    boolean primaryCode;

    public StudentCredential() {}

    public Long getId() {
        return id;
    }

    public Long getStudentId() {
        return studentId;
    }

    public String getCode() {
        return code;
    }

    public boolean getPrimaryCode() {
        return primaryCode;
    }
}
