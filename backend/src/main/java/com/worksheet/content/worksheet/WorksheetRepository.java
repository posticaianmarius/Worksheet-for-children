package com.worksheet.content.worksheet;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorksheetRepository extends JpaRepository<Worksheet, Long> {

    List<Worksheet> findByUser_Id(Long userId);

    Optional<Worksheet> findByIdAndUser_Id(Long id, Long userId);

    boolean existsByShareCode(String shareCode);

    @EntityGraph(attributePaths = {"user", "shareRevision", "shareRevision.worksheet"})
    Optional<Worksheet> findByShareCode(String shareCode);
}
