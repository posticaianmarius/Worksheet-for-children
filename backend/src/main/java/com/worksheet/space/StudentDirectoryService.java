package com.worksheet.space;

import com.worksheet.auth.*;
import com.worksheet.assignment.*;
import com.worksheet.attempt.*;
import com.worksheet.shared.codes.JoinCodeGenerator;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@Service
@Transactional
public class StudentDirectoryService {
    private final com.worksheet.classroom.ClassroomMemberRepository members;
    private final SpaceAccess access;
    private final JoinCodeGenerator codes;
    private final WorksheetAssignmentRepository assignments;
    private final WorksheetAttemptRepository attempts;
    public StudentDirectoryService(SpaceAccess access,JoinCodeGenerator codes,WorksheetAssignmentRepository assignments,WorksheetAttemptRepository attempts,com.worksheet.classroom.ClassroomMemberRepository members) {
        this.members=members;
        this.access=access; this.codes=codes; this.assignments=assignments; this.attempts=attempts;
    }
    public record Student(Long id,Long userId,String name,Instant archivedAt) {}
    public Student response(SpaceStudent s) { return new Student(s.id,s.userId,s.name,s.archivedAt); }
    public Map<Long,SpaceStudent> profiles(List<Long> ids) {
        return access.students.findAllById(ids).stream().collect(java.util.stream.Collectors.toMap(s -> s.id,s -> s));
    }
    public List<Student> list(Long spaceId,User actor) {
        access.teacher(spaceId,actor);
        return access.students.findBySpaceIdOrderByName(spaceId).stream().map(this::response).toList();
    }
    public SpaceStudent get(Long spaceId,Long id) {
        return access.students.findById(id).filter(s -> s.spaceId.equals(spaceId)).orElseThrow(SpaceAccess::missing);
    }
    public SpaceStudent create(Long spaceId,String name,boolean allowDuplicate,User actor) {
        access.teacher(spaceId,actor); name=validName(name);
        final String normalized=name;
        if(!allowDuplicate && access.students.findBySpaceIdOrderByName(spaceId).stream()
                .anyMatch(s -> s.archivedAt==null && s.name.equalsIgnoreCase(normalized)))
            throw new ResponseStatusException(CONFLICT,"A student with this name exists. Select them or confirm this is another child.");
        var user=access.users.saveAndFlush(new User(name,UUID.randomUUID()+"@student.invalid","!",UserRole.USER));
        return access.ensureStudent(spaceId,user);
    }
    public Student update(Long spaceId,Long id,String name,boolean archive,User actor) {
        access.owner(spaceId,actor); var student=get(spaceId,id);
        if(name!=null) student.name=validName(name);
        if(archive && student.archivedAt==null) {
            student.archivedAt=Instant.now(); student.credentialVersion++;
            access.credentials.deleteByStudentId(id);
            members.findByUser_IdAndLeftAtIsNullOrderByJoinedAtDesc(student.userId).stream().filter(m -> spaceId.equals(access.classSpace(m.getClassroom()))).forEach(com.worksheet.classroom.ClassroomMember::leave);
            var work=assignments.findBySpaceIdAndUser_IdOrderByAssignedAtDesc(spaceId,student.userId);
            work.forEach(WorksheetAssignment::revoke);
            for(var assignment:work) attempts.findByAssignment_IdAndStatus(assignment.getId(),AttemptStatus.IN_PROGRESS).forEach(WorksheetAttempt::abandon);
        }
        return response(student);
    }
    public record AccessCard(Long studentId,String name,String code) {}
    public AccessCard credential(Long spaceId,Long studentId,boolean rotate,User actor) {
        access.credentialManager(spaceId,actor);
        var student=access.students.lockById(studentId).filter(s -> s.spaceId.equals(spaceId) && s.archivedAt==null).orElseThrow(SpaceAccess::missing);
        var existing=access.credentials.findByStudentId(studentId);
        if(rotate) {
            access.credentials.deleteAll(existing); access.credentials.flush(); student.credentialVersion++; existing=List.of();
        }
        var credential=existing.stream().filter(c -> c.primaryCode).findFirst().orElse(null);
        if(credential==null) {
            credential=new StudentCredential(); credential.studentId=studentId; credential.primaryCode=true;
            do { credential.code=codes.generate(); } while(access.credentials.existsByCode(credential.code));
            access.credentials.saveAndFlush(credential);
        }
        return new AccessCard(student.id,student.name,credential.code);
    }
    public SpaceStudent authenticate(String code) {
        if(code==null || code.strip().length()!=8) throw invalid();
        var credential=access.credentials.findByCode(code.strip().toUpperCase(Locale.ROOT)).orElseThrow(StudentDirectoryService::invalid);
        var student=access.students.findById(credential.studentId).filter(s -> s.archivedAt==null).orElseThrow(StudentDirectoryService::invalid);
        if(user(student).getRole()!=UserRole.USER) throw new ResponseStatusException(FORBIDDEN,"Only students can use a student code.");
        return student;
    }
    public User user(SpaceStudent student) { return access.users.findById(student.userId).orElseThrow(SpaceAccess::missing); }
    private String validName(String name) {
        if(name==null || name.isBlank() || name.strip().length()>100) throw new ResponseStatusException(BAD_REQUEST,"Student name must contain 1 to 100 characters.");
        return name.strip();
    }
    public static ResponseStatusException invalid() { return new ResponseStatusException(NOT_FOUND,"Student code not found. Ask your teacher for your code."); }
}
