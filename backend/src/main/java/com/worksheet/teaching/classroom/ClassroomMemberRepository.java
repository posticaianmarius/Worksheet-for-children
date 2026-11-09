package com.worksheet.teaching.classroom;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClassroomMemberRepository extends JpaRepository<ClassroomMember, Long> {
    long countByClassroom_IdAndLeftAtIsNull(Long classroomId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"user", "classroom"})
    List<ClassroomMember> findByClassroom_IdOrderByJoinedAt(Long classroomId);

    Optional<ClassroomMember> findByStudentCodeAndLeftAtIsNull(String studentCode);

    boolean existsByStudentCode(String studentCode);

    boolean existsByUser_IdAndStudentCodeIsNotNull(Long userId);

    Optional<ClassroomMember>
            findFirstByUser_IdAndClassroom_Teacher_IdAndStudentCodeIsNotNullAndLeftAtIsNull(
                    Long userId, Long teacherId);

    List<ClassroomMember> findByUser_IdAndLeftAtIsNullOrderByJoinedAtDesc(Long userId);

    List<ClassroomMember> findByClassroom_IdAndLeftAtIsNullOrderByJoinedAt(Long classroomId);

    Optional<ClassroomMember> findByClassroom_IdAndUser_Id(Long classroomId, Long userId);

    Optional<ClassroomMember> findByClassroom_IdAndUser_IdAndLeftAtIsNull(
            Long classroomId, Long userId);

    boolean existsByClassroom_IdAndUser_IdAndLeftAtIsNull(Long classroomId, Long userId);

    boolean existsByClassroom_Teacher_IdAndUser_IdAndLeftAtIsNull(Long teacherId, Long userId);

    Optional<ClassroomMember>
            findFirstByClassroom_Teacher_IdAndUser_IdAndLeftAtIsNullOrderByJoinedAt(
                    Long teacherId, Long userId);
}
