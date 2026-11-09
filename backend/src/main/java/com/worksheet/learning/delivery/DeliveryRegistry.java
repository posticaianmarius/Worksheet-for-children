package com.worksheet.learning.delivery;

import com.worksheet.learning.assignment.WorksheetAssignment;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class DeliveryRegistry {
    private final AssignmentDeliveryRepository deliveries;

    public DeliveryRegistry(AssignmentDeliveryRepository deliveries) {
        this.deliveries = deliveries;
    }

    public AssignmentDelivery register(Long spaceId, WorksheetAssignment assignment, String title) {
        return deliveries
                .findByBatchId(assignment.getBatchId())
                .orElseGet(
                        () -> {
                            var delivery = new AssignmentDelivery();
                            delivery.batchId = assignment.getBatchId();
                            delivery.spaceId = spaceId;
                            delivery.creatorId = assignment.getTeacher().getId();
                            delivery.classroomId =
                                    assignment.getClassroom() == null
                                            ? null
                                            : assignment.getClassroom().getId();
                            delivery.revisionId = assignment.getWorksheetRevision().getId();
                            delivery.assignedAt = assignment.getAssignedAt();
                            delivery.title = title;
                            return deliveries.save(delivery);
                        });
    }
}
