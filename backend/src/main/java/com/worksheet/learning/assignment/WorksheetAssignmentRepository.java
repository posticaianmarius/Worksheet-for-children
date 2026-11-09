package com.worksheet.learning.assignment;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorksheetAssignmentRepository extends JpaRepository<WorksheetAssignment, Long> {
    @EntityGraph(
            attributePaths = {
                "worksheetRevision",
                "worksheetRevision.worksheet",
                "worksheetRevision.worksheet.user",
                "user",
                "classroom",
                "classroom.teacher"
            })
    @org.springframework.data.jpa.repository.Query(
            """
            select a from WorksheetAssignment a where a.spaceId=:spaceId
            and (:classroomId is null or a.classroom.id=:classroomId)
            and (:owner=true or (a.classroom is not null and exists
                (select c.id from ClassTeacher c where c.classroomId=a.classroom.id and c.userId=:userId))
                or (a.classroom is null and a.worksheetRevision.worksheet.user.id=:userId))
            order by a.assignedAt desc
            """)
    List<WorksheetAssignment> findVisible(
            @org.springframework.data.repository.query.Param("spaceId") Long spaceId,
            @org.springframework.data.repository.query.Param("userId") Long userId,
            @org.springframework.data.repository.query.Param("owner") boolean owner,
            @org.springframework.data.repository.query.Param("classroomId") Long classroomId);

    List<WorksheetAssignment> findBySpaceIdOrderByAssignedAtDesc(Long spaceId);

    List<WorksheetAssignment> findBySpaceIdAndUser_IdOrderByAssignedAtDesc(
            Long spaceId, Long userId);

    List<WorksheetAssignment> findByBatchId(java.util.UUID batchId);

    List<WorksheetAssignment> findByClassroom_Id(Long classroomId);

    List<WorksheetAssignment> findByClassroom_IdAndWorksheetRevision_Id(
            Long classroomId, Long revisionId);

    List<WorksheetAssignment> findByClassroomIsNullAndWorksheetRevision_Id(Long revisionId);

    boolean existsByWorksheetRevision_IdAndUser_IdAndRemovedAtIsNotNull(
            Long revisionId, Long userId);

    @EntityGraph(
            attributePaths = {
                "worksheetRevision",
                "worksheetRevision.worksheet",
                "worksheetRevision.worksheet.user",
                "worksheetRevision.worksheet.shareRevision",
                "user",
                "classroom"
            })
    List<WorksheetAssignment> findByWorksheetRevision_Worksheet_User_IdOrderByAssignedAtDesc(
            Long teacherId);

    @EntityGraph(
            attributePaths = {
                "worksheetRevision",
                "worksheetRevision.worksheet",
                "worksheetRevision.worksheet.user",
                "user",
                "classroom"
            })
    List<WorksheetAssignment> findByUser_IdAndRevokedAtIsNullOrderByAssignedAtDesc(Long userId);

    List<WorksheetAssignment> findByClassroom_IdAndUser_IdAndRevokedAtIsNull(
            Long classroomId, Long userId);

    List<WorksheetAssignment> findByClassroom_IdAndUser_IdOrderByAssignedAtDesc(
            Long classroomId, Long userId);

    Optional<WorksheetAssignment>
            findFirstByWorksheetRevision_IdAndUser_IdAndRevokedAtIsNullOrderByAssignedAtDesc(
                    Long revisionId, Long userId);

    Optional<WorksheetAssignment>
            findFirstByWorksheetRevision_IdAndUser_IdAndClassroom_IdAndRevokedAtIsNullOrderByAssignedAtDesc(
                    Long revisionId, Long userId, Long classroomId);

    @Override
    @EntityGraph(
            attributePaths = {
                "worksheetRevision",
                "worksheetRevision.worksheet",
                "worksheetRevision.worksheet.user",
                "user",
                "classroom"
            })
    Optional<WorksheetAssignment> findById(Long id);
}
