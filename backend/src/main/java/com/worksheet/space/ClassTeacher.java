package com.worksheet.space;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="class_teacher", uniqueConstraints=@UniqueConstraint(columnNames={"classroom_id","user_id"}))
public class ClassTeacher {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
 public Long id;
 @Column(name="classroom_id")
 public Long classroomId;
 @Column(name="user_id")
 public Long userId;
 public ClassTeacher() {}
}

