package com.worksheet.space;

import com.worksheet.auth.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@Service
@Transactional
public class SpaceTeamService {
    private final SpaceAccess access;
    private final SpaceInvitationRepository invitations;
    public SpaceTeamService(SpaceAccess access,SpaceInvitationRepository invitations) { this.access=access; this.invitations=invitations; }
    public record TeamMember(Long userId,String name,String email,boolean owner,boolean manageStudentAccess) {}
    public List<TeamMember> team(Long spaceId,User actor) {
        access.teacher(spaceId,actor);
        return access.teachers.findBySpaceId(spaceId).stream().map(member -> {
            var user=access.users.findById(member.userId).orElseThrow(SpaceAccess::missing);
            return new TeamMember(user.getId(),user.getName(),user.getEmail(),member.owner,member.manageStudentAccess || member.owner);
        }).toList();
    }
    public void permission(Long spaceId,Long userId,boolean permitted,User actor) {
        access.owner(spaceId,actor); var member=access.teacher(spaceId,access.users.findById(userId).orElseThrow(SpaceAccess::missing));
        member.manageStudentAccess=permitted;
    }
    public void transfer(Long spaceId,Long userId,User actor) {
        access.spaces.lockById(spaceId).orElseThrow(SpaceAccess::missing);
        access.owner(spaceId,actor);
        if(actor.getId().equals(userId)) return;
        var next=access.teacher(spaceId,access.users.findById(userId).orElseThrow(SpaceAccess::missing));
        var previous=access.teacher(spaceId,actor); previous.owner=false; next.owner=true; next.manageStudentAccess=true;
    }
    public void remove(Long spaceId,Long userId,User actor) {
        access.spaces.lockById(spaceId).orElseThrow(SpaceAccess::missing);
        access.owner(spaceId,actor);
        var member=access.teachers.findBySpaceIdAndUserId(spaceId,userId).orElseThrow(SpaceAccess::missing);
        if(member.owner || access.classrooms.findBySpaceIdOrderByCreatedAtDesc(spaceId).stream().anyMatch(c -> c.getArchivedAt()==null && c.getTeacher().getId().equals(userId)))
            throw new ResponseStatusException(CONFLICT,"Transfer ownership and lead-teacher responsibilities before removing this teacher.");
        access.classTeachers.findByUserId(userId).stream()
            .filter(c -> access.classrooms.findById(c.classroomId).map(cl -> spaceId.equals(cl.getSpaceId())).orElse(false))
            .forEach(access.classTeachers::delete);
        access.teachers.delete(member);
    }
    public record Invite(Long id,Instant expiresAt,Instant usedAt,Instant revokedAt) {}
    public record CreatedInvite(Long id,String token,Instant expiresAt) {}
    public List<Invite> invitations(Long spaceId,User actor) {
        access.owner(spaceId,actor);
        return invitations.findBySpaceIdOrderByIdDesc(spaceId).stream().map(i -> new Invite(i.id,i.expiresAt,i.usedAt,i.revokedAt)).toList();
    }
    public CreatedInvite invite(Long spaceId,User actor) {
        access.owner(spaceId,actor);
        byte[] bytes=new byte[32]; new SecureRandom().nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        var invitation=new SpaceInvitation(); invitation.spaceId=spaceId; invitation.tokenHash=hash(token);
        invitation.expiresAt=Instant.now().plus(Duration.ofDays(7)); invitations.save(invitation);
        return new CreatedInvite(invitation.id,token,invitation.expiresAt);
    }
    public void revoke(Long spaceId,Long invitationId,User actor) {
        access.owner(spaceId,actor);
        invitations.findById(invitationId).filter(i -> i.spaceId.equals(spaceId)).orElseThrow(SpaceAccess::missing).revokedAt=Instant.now();
    }
    public Long accept(String token,User actor) {
        if(actor.getRole()!=UserRole.TEACHER) throw new ResponseStatusException(FORBIDDEN,"Sign in as a teacher to accept this invitation.");
        if(token==null || token.length()>100) throw SpaceAccess.missing();
        var invitation=invitations.lockByHash(hash(token)).filter(i -> i.usedAt==null && i.revokedAt==null && i.expiresAt.isAfter(Instant.now())).orElseThrow(SpaceAccess::missing);
        if(access.teachers.findBySpaceIdAndUserId(invitation.spaceId,actor.getId()).isEmpty()) {
            var member=new SpaceTeacher(); member.spaceId=invitation.spaceId; member.userId=actor.getId(); access.teachers.save(member);
        }
        invitation.usedAt=Instant.now(); return invitation.spaceId;
    }
    public List<TeamMember> classTeachers(Long classroomId,User actor) {
        var classroom=access.requireClass(classroomId,actor,false);
        var ids=new HashSet<>(access.classTeachers.findByClassroomId(classroomId).stream().map(c -> c.userId).toList());
        ids.add(classroom.getTeacher().getId());
        return team(classroom.getSpaceId(),actor).stream().filter(m -> ids.contains(m.userId())).toList();
    }
    public void classTeacher(Long classroomId,Long userId,boolean remove,boolean lead,User actor) {
        var classroom=access.requireClass(classroomId,actor,true);
        if(!access.teacher(classroom.getSpaceId(),actor).owner && !classroom.getTeacher().getId().equals(actor.getId()))
            throw new ResponseStatusException(FORBIDDEN,"Only the owner or lead teacher manages co-teachers.");
        var user=access.users.findById(userId).orElseThrow(SpaceAccess::missing); access.teacher(classroom.getSpaceId(),user);
        var existing=access.classTeachers.findByClassroomIdAndUserId(classroomId,userId);
        if(remove) {
            if(classroom.getTeacher().getId().equals(userId)) throw new ResponseStatusException(CONFLICT,"Choose a new lead teacher first.");
            existing.ifPresent(access.classTeachers::delete);
        } else {
            if(existing.isEmpty()) { var member=new ClassTeacher(); member.classroomId=classroomId; member.userId=userId; access.classTeachers.save(member); }
            if(lead) classroom.setTeacher(user);
        }
    }
    private static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
}
