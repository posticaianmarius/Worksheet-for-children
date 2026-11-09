package com.worksheet.teaching.api;

import com.worksheet.teaching.classroom.ClassroomMember;
import com.worksheet.teaching.classroom.ClassroomMemberRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/** ID-based queries; mapped members are retained for existing JPA associations. */
@Service
@Transactional(readOnly = true)
public class ClassRosters {
    private final ClassroomMemberRepository members;

    public ClassRosters(ClassroomMemberRepository members) {
        this.members = members;
    }

    public List<ClassroomMember> activeMembers(Long classId) {
        return members.findByClassroom_IdAndLeftAtIsNullOrderByJoinedAt(classId);
    }

    public List<ClassroomMember> memberships(Long userId) {
        return members.findByUser_IdAndLeftAtIsNullOrderByJoinedAtDesc(userId);
    }

    public Optional<ClassroomMember> earliestMembership(Long teacherId, Long userId) {
        return members.findFirstByClassroom_Teacher_IdAndUser_IdAndLeftAtIsNullOrderByJoinedAt(
                teacherId, userId);
    }
}
