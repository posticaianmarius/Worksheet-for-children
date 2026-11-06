package com.worksheet.classroom;
import com.worksheet.auth.CodeSessionValidator;
import com.worksheet.space.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
@Component
public class StudentCodeSessionValidator implements CodeSessionValidator {
 private final StudentCredentialRepository credentials;
 private final SpaceStudentRepository students;
 public StudentCodeSessionValidator(StudentCredentialRepository credentials,SpaceStudentRepository students) { this.credentials=credentials; this.students=students; }
 @Override @Transactional(readOnly=true)
 public boolean isValid(Long userId,String code) {
  return credentials.findByCode(code).flatMap(c -> students.findById(c.studentId)).filter(s -> s.archivedAt==null && s.userId.equals(userId)).isPresent();
 }
}
