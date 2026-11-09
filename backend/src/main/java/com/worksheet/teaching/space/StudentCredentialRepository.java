package com.worksheet.teaching.space;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentCredentialRepository extends JpaRepository<StudentCredential, Long> {
    java.util.Optional<StudentCredential> findByCode(String code);

    java.util.List<StudentCredential> findByStudentId(Long id);

    boolean existsByCode(String code);

    void deleteByStudentId(Long id);
}
