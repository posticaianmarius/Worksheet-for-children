package com.worksheet.space;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TeachingSpaceRepository extends JpaRepository<TeachingSpace, Long> {
 @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
 @org.springframework.data.jpa.repository.Query("select s from TeachingSpace s where s.id=:id")
 java.util.Optional<TeachingSpace> lockById(@org.springframework.data.repository.query.Param("id") Long id);
 java.util.Optional<TeachingSpace> findByPersonalOwnerId(Long id);
}

