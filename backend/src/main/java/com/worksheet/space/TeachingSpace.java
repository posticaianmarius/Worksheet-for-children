package com.worksheet.space;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="teaching_space")
public class TeachingSpace {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
 public Long id;
 @Column(name="personal_owner_id", unique=true)
 public Long personalOwnerId;
 @Column(name="name")
 public String name;
 @Column(name="created_at")
 public Instant createdAt;
 public TeachingSpace() {}
}

