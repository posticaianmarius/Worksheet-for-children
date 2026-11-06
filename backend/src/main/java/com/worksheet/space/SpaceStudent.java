package com.worksheet.space;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="space_student", uniqueConstraints=@UniqueConstraint(columnNames={"space_id","user_id"}))
public class SpaceStudent {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
 public Long id;
 @Column(name="space_id")
 public Long spaceId;
 @Column(name="user_id")
 public Long userId;
 @Column(name="name")
 public String name;
 @Column(name="archived_at")
 public Instant archivedAt;
 @Column(name="credential_version")
 public long credentialVersion;
 public SpaceStudent() {}
}

