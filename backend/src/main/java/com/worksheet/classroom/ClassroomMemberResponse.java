package com.worksheet.classroom;

import java.time.Instant;

public record ClassroomMemberResponse(Long userId, String name, String email, Instant joinedAt,
    String studentCode, Integer lastTestPercent, Integer averagePercent, String worstTest,Long studentId,Instant leftAt) {}
