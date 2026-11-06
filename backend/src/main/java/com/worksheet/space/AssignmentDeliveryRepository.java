package com.worksheet.space;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AssignmentDeliveryRepository extends JpaRepository<AssignmentDelivery, Long> {
 java.util.Optional<AssignmentDelivery> findByBatchId(java.util.UUID batchId);
}

