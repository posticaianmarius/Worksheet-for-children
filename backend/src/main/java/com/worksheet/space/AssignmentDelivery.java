package com.worksheet.space;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="assignment_delivery")
public class AssignmentDelivery {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
 public Long id;
 @Column(name="batch_id", unique=true)
 public java.util.UUID batchId;
 @Column(name="space_id")
 public Long spaceId;
 @Column(name="creator_id")
 public Long creatorId;
 @Column(name="classroom_id")
 public Long classroomId;
 @Column(name="revision_id")
 public Long revisionId;
 @Column(name="title")
 public String title;
 @Column(name="assigned_at")
 public Instant assignedAt;
 @Column(name="closed_at")
 public Instant closedAt;
 public AssignmentDelivery() {}
}

