package com.worksheet.space;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassTeacherRepository extends JpaRepository<ClassTeacher, Long> {
 java.util.List<ClassTeacher> findByClassroomId(Long id);
 java.util.List<ClassTeacher> findByUserId(Long id);
 java.util.Optional<ClassTeacher> findByClassroomIdAndUserId(Long classroomId, Long userId);
}

