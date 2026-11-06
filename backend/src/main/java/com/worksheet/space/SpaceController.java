package com.worksheet.space;

import com.worksheet.auth.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import static org.springframework.http.HttpStatus.*;

@RestController
@Transactional
public class SpaceController {
    private final com.worksheet.classroom.ClassroomService classroomService;
    private final AuthSessionService sessions;
    private final SpaceAccess access;
    private final StudentDirectoryService directory;
    private final SpaceTeamService team;
    public SpaceController(AuthSessionService sessions,SpaceAccess access,StudentDirectoryService directory,SpaceTeamService team,com.worksheet.classroom.ClassroomService classroomService) {
        this.classroomService=classroomService;
        this.sessions=sessions; this.access=access; this.directory=directory; this.team=team;
    }
    public record SpaceView(Long id,String name,boolean owner,boolean manageStudentAccess) {}
    public record Context(Long spaceId,List<SpaceView> spaces,StudentDirectoryService.Student student,boolean owner,boolean manageStudentAccess) {}
    @GetMapping("/api/auth/context")
    public Context context(HttpServletRequest request) {
        var user=sessions.requireUser(request); var options=new ArrayList<SpaceView>();
        if(user.getRole()==UserRole.TEACHER) {
            var memberships=access.teachers.findByUserId(user.getId());
            if(memberships.isEmpty()) memberships=List.of(access.teacher(access.personal(user).id,user));
            for(var member:memberships) { var space=access.spaces.findById(member.spaceId).orElseThrow(SpaceAccess::missing);
                options.add(new SpaceView(space.id,space.name,member.owner,member.owner||member.manageStudentAccess)); }
        } else {
            var code=request.getSession().getAttribute("auth.studentCode");
            var bound=code instanceof String value?directory.authenticate(value):null;
            for(var student:access.students.findByUserId(user.getId())) if(student.archivedAt==null && (bound==null || bound.id.equals(student.id))) {
                var space=access.spaces.findById(student.spaceId).orElseThrow(SpaceAccess::missing);
                options.add(new SpaceView(space.id,space.name,false,false));
            }
        }
        Long selected=null;
        try { selected=access.currentSpace(user); } catch(org.springframework.web.server.ResponseStatusException ex) {
            if(ex.getStatusCode().value()!=409 && ex.getStatusCode().value()!=404) throw ex;
            if(ex.getStatusCode().value()==404 && !options.isEmpty()) selected=options.getFirst().id();
        }
        final Long id=selected;
        var chosen=options.stream().filter(s -> s.id().equals(id)).findFirst().orElse(null);
        var student=id==null?null:access.students.findBySpaceIdAndUserId(id,user.getId()).map(directory::response).orElse(null);
        return new Context(id,options,student,chosen!=null&&chosen.owner(),chosen!=null&&chosen.manageStudentAccess());
    }
    public record Selection(Long spaceId) {}
    @PostMapping("/api/auth/context")
    public Selection select(@RequestBody Selection input,HttpServletRequest request) {
        var user=sessions.requireUser(request);
        if(input.spaceId()==null) throw SpaceAccess.missing();
        if(user.getRole()==UserRole.TEACHER) access.teacher(input.spaceId(),user);
        else {
            var code=request.getSession().getAttribute("auth.studentCode");
            if(code instanceof String value && !directory.authenticate(value).spaceId.equals(input.spaceId())) throw SpaceAccess.missing();
            access.students.findBySpaceIdAndUserId(input.spaceId(),user.getId()).filter(s -> s.archivedAt==null).orElseThrow(SpaceAccess::missing);
        }
        request.getSession().setAttribute("auth.spaceId",input.spaceId());
        return new Selection(input.spaceId());
    }
    @GetMapping("/api/spaces")
    public List<SpaceView> spaces(HttpServletRequest request) { return context(request).spaces(); }
    public record Rename(String name) {}
    @PatchMapping("/api/spaces/{spaceId}")
    public void rename(@PathVariable Long spaceId,@RequestBody Rename input,HttpServletRequest request) {
        access.owner(spaceId,sessions.requireUser(request));
        if(input.name()==null || input.name().isBlank() || input.name().strip().length()>150) throw new org.springframework.web.server.ResponseStatusException(BAD_REQUEST,"Enter a space name (1–150 characters).");
        access.spaces.findById(spaceId).orElseThrow(SpaceAccess::missing).name=input.name().strip();
    }
    @GetMapping("/api/spaces/{spaceId}/members")
    public List<SpaceTeamService.TeamMember> members(@PathVariable Long spaceId,HttpServletRequest request) { return team.team(spaceId,sessions.requireUser(request)); }
    public record Permission(boolean manageStudentAccess) {}
    @PatchMapping("/api/spaces/{spaceId}/members/{userId}")
    public void permission(@PathVariable Long spaceId,@PathVariable Long userId,@RequestBody Permission input,HttpServletRequest request) { team.permission(spaceId,userId,input.manageStudentAccess(),sessions.requireUser(request)); }
    @PostMapping("/api/spaces/{spaceId}/owner/{userId}")
    public void transfer(@PathVariable Long spaceId,@PathVariable Long userId,HttpServletRequest request) { team.transfer(spaceId,userId,sessions.requireUser(request)); }
    @DeleteMapping("/api/spaces/{spaceId}/members/{userId}")
    public void remove(@PathVariable Long spaceId,@PathVariable Long userId,HttpServletRequest request) { team.remove(spaceId,userId,sessions.requireUser(request)); }
    @GetMapping("/api/spaces/{spaceId}/invitations")
    public List<SpaceTeamService.Invite> invitations(@PathVariable Long spaceId,HttpServletRequest request) { return team.invitations(spaceId,sessions.requireUser(request)); }
    @PostMapping("/api/spaces/{spaceId}/invitations")
    public ResponseEntity<SpaceTeamService.CreatedInvite> invite(@PathVariable Long spaceId,HttpServletRequest request) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(team.invite(spaceId,sessions.requireUser(request))); }
    @DeleteMapping("/api/spaces/{spaceId}/invitations/{id}")
    public void revoke(@PathVariable Long spaceId,@PathVariable Long id,HttpServletRequest request) { team.revoke(spaceId,id,sessions.requireUser(request)); }
    public record Token(String token) {}
    @PostMapping("/api/spaces/invitations/accept")
    public Selection accept(@RequestBody Token input,HttpServletRequest request) {
        Long id=team.accept(input.token(),sessions.requireUser(request)); request.getSession().setAttribute("auth.spaceId",id); return new Selection(id);
    }
    @GetMapping("/api/spaces/{spaceId}/students")
    public List<StudentDirectoryService.Student> students(@PathVariable Long spaceId,HttpServletRequest request) { return directory.list(spaceId,sessions.requireUser(request)); }
    public record NewStudent(String name,Boolean allowDuplicate) {}
    @PostMapping("/api/spaces/{spaceId}/students")
    public StudentDirectoryService.Student create(@PathVariable Long spaceId,@RequestBody NewStudent input,HttpServletRequest request) { return directory.response(directory.create(spaceId,input.name(),Boolean.TRUE.equals(input.allowDuplicate()),sessions.requireUser(request))); }
    public record BulkRow(String name,Long studentId,Boolean allowDuplicate) {}
    public record BulkInput(Long classroomId,List<BulkRow> rows) {}
    @PostMapping("/api/spaces/{spaceId}/students/bulk")
    public List<StudentDirectoryService.Student> bulk(@PathVariable Long spaceId,@RequestBody BulkInput input,HttpServletRequest request) {
        var actor=sessions.requireUser(request); access.teacher(spaceId,actor);
        if(input.rows()==null || input.rows().isEmpty() || input.rows().size()>200) throw new org.springframework.web.server.ResponseStatusException(BAD_REQUEST,"Provide 1 to 200 students.");
        if(input.classroomId()!=null && !spaceId.equals(access.requireClass(input.classroomId(),actor,true).getSpaceId())) throw SpaceAccess.missing();
        var result=new ArrayList<StudentDirectoryService.Student>(); var seen=new HashSet<Long>();
        for(var row:input.rows()) {
            var student=row.studentId()==null?directory.create(spaceId,row.name(),Boolean.TRUE.equals(row.allowDuplicate()),actor):directory.get(spaceId,row.studentId());
            if(!seen.add(student.id)) throw new org.springframework.web.server.ResponseStatusException(CONFLICT,"The same student was selected more than once.");
            if(input.classroomId()!=null) classroomService.addStudent(input.classroomId(),actor,new com.worksheet.classroom.StudentNameRequest(null,student.id,false));
            result.add(directory.response(student));
        }
        return result;
    }
    public record UpdateStudent(String name,Boolean archive) {}
    @PatchMapping("/api/spaces/{spaceId}/students/{id}")
    public StudentDirectoryService.Student update(@PathVariable Long spaceId,@PathVariable Long id,@RequestBody UpdateStudent input,HttpServletRequest request) { return directory.update(spaceId,id,input.name(),Boolean.TRUE.equals(input.archive()),sessions.requireUser(request)); }
    @PostMapping("/api/spaces/{spaceId}/students/{id}/credential")
    public ResponseEntity<StudentDirectoryService.AccessCard> credential(@PathVariable Long spaceId,@PathVariable Long id,HttpServletRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(directory.credential(spaceId,id,false,sessions.requireUser(request)));
    }
    @PostMapping("/api/spaces/{spaceId}/students/{id}/credential/rotate")
    public ResponseEntity<StudentDirectoryService.AccessCard> rotate(@PathVariable Long spaceId,@PathVariable Long id,HttpServletRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(directory.credential(spaceId,id,true,sessions.requireUser(request)));
    }
    @GetMapping("/api/classes/{classroomId}/teachers")
    public List<SpaceTeamService.TeamMember> classTeachers(@PathVariable Long classroomId,HttpServletRequest request) { return team.classTeachers(classroomId,sessions.requireUser(request)); }
    public record ClassTeacherInput(Long userId,Boolean lead) {}
    @PostMapping("/api/classes/{classroomId}/teachers")
    public void classTeacher(@PathVariable Long classroomId,@RequestBody ClassTeacherInput input,HttpServletRequest request) { team.classTeacher(classroomId,input.userId(),false,Boolean.TRUE.equals(input.lead()),sessions.requireUser(request)); }
    @DeleteMapping("/api/classes/{classroomId}/teachers/{userId}")
    public void removeClassTeacher(@PathVariable Long classroomId,@PathVariable Long userId,HttpServletRequest request) { team.classTeacher(classroomId,userId,true,false,sessions.requireUser(request)); }
}
