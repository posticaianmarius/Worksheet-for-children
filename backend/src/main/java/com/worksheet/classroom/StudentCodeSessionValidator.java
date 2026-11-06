package com.worksheet.classroom;

import com.worksheet.auth.CodeSessionValidator;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class StudentCodeSessionValidator implements CodeSessionValidator {
    private final ClassroomMemberRepository members;
    public StudentCodeSessionValidator(ClassroomMemberRepository members) { this.members = members; }
    @Override
    @Transactional(readOnly = true)
    public boolean isValid(Long userId, String code) {
        return members.findByStudentCodeAndLeftAtIsNull(code)
            .filter(member -> member.getUser().getId().equals(userId))
            .filter(member -> member.getClassroom().getArchivedAt() == null).isPresent();
    }
}
