package com.worksheet.space;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TeachingSpaceRepository extends JpaRepository<TeachingSpace, Long> {
 java.util.Optional<TeachingSpace> findByPersonalOwnerId(Long id);
}

