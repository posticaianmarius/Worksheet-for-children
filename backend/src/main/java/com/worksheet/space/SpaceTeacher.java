package com.worksheet.space;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="space_teacher", uniqueConstraints=@UniqueConstraint(columnNames={"space_id","user_id"}))
public class SpaceTeacher {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
 public Long id;
 @Column(name="space_id")
 public Long spaceId;
 @Column(name="user_id")
 public Long userId;
 @Column(name="is_owner")
 public boolean owner;
 @Column(name="manage_student_access")
 public boolean manageStudentAccess;
 public SpaceTeacher() {}
}

