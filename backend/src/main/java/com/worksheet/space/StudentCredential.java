package com.worksheet.space;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="student_credential")
public class StudentCredential {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
 public Long id;
 @Column(name="student_id")
 public Long studentId;
 @Column(name="code", unique=true, length=8)
 public String code;
 @Column(name="primary_code")
 public boolean primaryCode;
 public StudentCredential() {}
}

