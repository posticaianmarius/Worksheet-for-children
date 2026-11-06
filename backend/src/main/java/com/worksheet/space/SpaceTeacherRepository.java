package com.worksheet.space;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SpaceTeacherRepository extends JpaRepository<SpaceTeacher, Long> {
 java.util.List<SpaceTeacher> findByUserId(Long id);
 java.util.List<SpaceTeacher> findBySpaceId(Long id);
 java.util.Optional<SpaceTeacher> findBySpaceIdAndUserId(Long spaceId, Long userId);
}

