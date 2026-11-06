package com.worksheet.classroom;
import com.worksheet.auth.*;
import com.worksheet.space.*;
import com.worksheet.worksheet.WorksheetShareService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class StudentPlayService {
 private final StudentDirectoryService directory;
 private final WorksheetShareService shares;
 public StudentPlayService(StudentDirectoryService directory,WorksheetShareService shares) { this.directory=directory; this.shares=shares; }
 @Transactional public UserResponse login(String code) {
  var student=directory.authenticate(code); var user=directory.user(student);
  return new UserResponse(user.getId(),student.name,null,user.getRole(),user.getCreatedAt());
 }
 @Transactional public StudentEntry join(String code,String worksheetCode) {
  var student=directory.authenticate(code);
  var result=shares.joinInSpace(worksheetCode,directory.user(student),student.spaceId);
  return new StudentEntry(login(code),result.assignmentId());
 }
 public record StudentEntry(UserResponse user,Long assignmentId) {}
}
