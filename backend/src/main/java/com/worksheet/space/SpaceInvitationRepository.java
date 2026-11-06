package com.worksheet.space;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SpaceInvitationRepository extends JpaRepository<SpaceInvitation, Long> {
 @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
 @org.springframework.data.jpa.repository.Query("select i from SpaceInvitation i where i.tokenHash=:hash")
 java.util.Optional<SpaceInvitation> lockByHash(@org.springframework.data.repository.query.Param("hash") String hash);
 java.util.Optional<SpaceInvitation> findByTokenHash(String hash);
 java.util.List<SpaceInvitation> findBySpaceIdOrderByIdDesc(Long id);
}

