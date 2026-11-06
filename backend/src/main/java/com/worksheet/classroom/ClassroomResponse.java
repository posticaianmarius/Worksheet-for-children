package com.worksheet.classroom;
import java.time.Instant;
public record ClassroomResponse(Long id,String name,Long teacherId,String teacherName,String joinCode,Instant createdAt,Long spaceId,Instant archivedAt,long studentCount) {}
