package com.worksheet.classroom;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassroomRepository extends JpaRepository<Classroom, Long> {
    List<Classroom> findBySpaceIdOrderByCreatedAtDesc(Long spaceId);
    List<Classroom> findByTeacher_IdOrderByCreatedAtDesc(Long teacherId);
    Optional<Classroom> findByIdAndTeacher_Id(Long id, Long teacherId);
    Optional<Classroom> findByJoinCode(String joinCode);
    boolean existsByJoinCode(String joinCode);
}
