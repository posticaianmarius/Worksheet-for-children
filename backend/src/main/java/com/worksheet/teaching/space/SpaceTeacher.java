package com.worksheet.teaching.space;

import jakarta.persistence.*;

@Entity
@Table(
        name = "space_teacher",
        uniqueConstraints = @UniqueConstraint(columnNames = {"space_id", "user_id"}))
public class SpaceTeacher {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "space_id")
    Long spaceId;

    @Column(name = "user_id")
    Long userId;

    @Column(name = "is_owner")
    boolean owner;

    @Column(name = "manage_student_access")
    boolean manageStudentAccess;

    public SpaceTeacher() {}

    public Long getId() {
        return id;
    }

    public Long getSpaceId() {
        return spaceId;
    }

    public Long getUserId() {
        return userId;
    }

    public boolean getOwner() {
        return owner;
    }

    public boolean getManageStudentAccess() {
        return manageStudentAccess;
    }
}
