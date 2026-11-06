package com.worksheet.space;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SpaceStudentRepository extends JpaRepository<SpaceStudent, Long> {
 @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
 @org.springframework.data.jpa.repository.Query("select s from SpaceStudent s where s.id=:id")
 java.util.Optional<SpaceStudent> lockById(@org.springframework.data.repository.query.Param("id") Long id);
 java.util.List<SpaceStudent> findBySpaceIdOrderByName(Long id);
 java.util.List<SpaceStudent> findByUserId(Long id);
 java.util.Optional<SpaceStudent> findBySpaceIdAndUserId(Long spaceId, Long userId);
}

