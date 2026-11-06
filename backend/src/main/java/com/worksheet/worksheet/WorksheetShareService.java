package com.worksheet.worksheet;

import com.worksheet.assignment.WorksheetAssignment;
import com.worksheet.assignment.WorksheetAssignmentRepository;
import com.worksheet.auth.User;
import com.worksheet.auth.UserRole;
import com.worksheet.classroom.ClassroomMember;
import com.worksheet.classroom.ClassroomMemberRepository;
import com.worksheet.shared.codes.JoinCodeGenerator;
import com.worksheet.worksheet.revision.WorksheetRevision;
import com.worksheet.worksheet.revision.WorksheetRevisionItemRepository;
import com.worksheet.worksheet.revision.WorksheetRevisionResponseMapper;
import com.worksheet.worksheet.revision.WorksheetRevisionService;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class WorksheetShareService {
    private final com.worksheet.space.SpaceAccess spaces;
    private final WorksheetRepository worksheets;
    private final WorksheetAssignmentRepository assignments;
    private final WorksheetRevisionService revisions;
    private final WorksheetRevisionItemRepository revisionItems;
    private final WorksheetRevisionResponseMapper responseMapper;
    private final JoinCodeGenerator codes;
    private final ClassroomMemberRepository members;

    public WorksheetShareService(WorksheetRepository worksheets,
                                 WorksheetAssignmentRepository assignments,
                                 WorksheetRevisionService revisions,
                                 WorksheetRevisionItemRepository revisionItems,
                                 WorksheetRevisionResponseMapper responseMapper,
                                 JoinCodeGenerator codes, ClassroomMemberRepository members,com.worksheet.space.SpaceAccess spaces) {
        this.spaces=spaces;
        this.worksheets = worksheets;
        this.assignments = assignments;
        this.revisions = revisions;
        this.revisionItems = revisionItems;
        this.responseMapper = responseMapper;
        this.codes = codes;
        this.members = members;
    }

    public String share(Long worksheetId, User teacher) {
        requireRole(teacher, UserRole.TEACHER);
        Worksheet worksheet = requireOwned(worksheetId, teacher.getId());
        if (worksheet.getShareCode() != null && worksheet.getShareRevision() != null) {
            return worksheet.getShareCode();
        }

        WorksheetRevision revision = publishNonEmpty(worksheet);
        String code = worksheet.getShareCode() == null ? nextCode() : worksheet.getShareCode();
        worksheet.share(code, revision);
        worksheets.save(worksheet);
        return code;
    }

    public String rotate(Long worksheetId, User teacher) {
        requireRole(teacher, UserRole.TEACHER);
        Worksheet worksheet = requireOwned(worksheetId, teacher.getId());
        worksheet.share(nextCode(), publishNonEmpty(worksheet));
        worksheets.save(worksheet);
        return worksheet.getShareCode();
    }

    public JoinWorksheetResponse join(String rawCode, User user) {
        requireRole(user, UserRole.USER);
        return join(rawCode, user, null);
    }

    public JoinWorksheetResponse joinForStudent(String rawCode, ClassroomMember member) {
        requireRole(member.getUser(), UserRole.USER);
        return join(rawCode, member.getUser(), member);
    }

    public String shareCurrent(Long worksheetId, User teacher) {
        requireRole(teacher, UserRole.TEACHER);
        Worksheet worksheet = requireOwned(worksheetId, teacher.getId());
        String code = worksheet.getShareCode() == null ? nextCode() : worksheet.getShareCode();
        worksheet.share(code, publishNonEmpty(worksheet));
        worksheets.save(worksheet);
        return code;
    }

    private JoinWorksheetResponse join(String rawCode,User user,ClassroomMember member) {
        return joinInSpace(rawCode,user,member==null?spaces.currentSpace(user):spaces.classSpace(member.getClassroom()));
    }
    public record Choice(Long assignmentId,UUID batchId,String classroomName,String title) {}
    public java.util.List<Choice> choices(String rawCode,User user) {
        Long spaceId=spaces.currentSpace(user);
        var worksheet=worksheets.findByShareCode(normalize(rawCode)).orElseThrow(this::codeNotFound);
        if(worksheet.getShareRevision()==null) return java.util.List.of();
        return assignments.findBySpaceIdAndUser_IdOrderByAssignedAtDesc(spaceId,user.getId()).stream()
            .filter(a -> a.getWorksheetRevision().getId().equals(worksheet.getShareRevision().getId()) && spaces.canWrite(a,user))
            .map(a -> new Choice(a.getId(),a.getBatchId(),a.getClassroom()==null?null:a.getClassroom().getName(),spaces.register(a,null).title)).toList();
    }
    public JoinWorksheetResponse joinInSpace(String rawCode,User user,Long spaceId) {
        var worksheet=worksheets.findByShareCode(normalize(rawCode)).orElseThrow(this::codeNotFound);
        var revision=worksheet.getShareRevision();
        if(revision==null) { revision=publishNonEmpty(worksheet); worksheet.share(worksheet.getShareCode(),revision); }
        final var pinned=revision;
        var candidates=spaceId==null?java.util.List.<WorksheetAssignment>of():assignments.findBySpaceIdAndUser_IdOrderByAssignedAtDesc(spaceId,user.getId()).stream()
            .filter(a -> a.getWorksheetRevision().getId().equals(pinned.getId()) && a.getRevokedAt()==null
                && (a.getClassroom()==null || a.getClassroom().getArchivedAt()==null)).toList();
        if(candidates.size()>1) throw new ResponseStatusException(HttpStatus.CONFLICT,"Choose the class and assignment you want to open.");
        if(candidates.size()==1) return JoinWorksheetResponse.from(responseMapper.toResponse(pinned),candidates.getFirst().getId());
        // Historic general share codes can create direct work only inside the author's personal space.
        Long sourceSpace=spaces.personal(worksheet.getUser()).id;
        if(spaceId!=null && !spaceId.equals(sourceSpace)) throw codeNotFound();
        var profile=spaces.ensureStudent(sourceSpace,user);
        if(profile.archivedAt!=null || assignments.existsByWorksheetRevision_IdAndUser_IdAndRemovedAtIsNotNull(pinned.getId(),user.getId())) throw codeNotFound();
        if("!".equals(user.getPasswordHash())) {
            boolean eligible=members.findByUser_IdAndLeftAtIsNullOrderByJoinedAtDesc(user.getId()).stream()
                .anyMatch(m -> sourceSpace.equals(spaces.classSpace(m.getClassroom())) && m.getClassroom().getArchivedAt()==null);
            if(!eligible) throw codeNotFound();
            var classIds=members.findByUser_IdAndLeftAtIsNullOrderByJoinedAtDesc(user.getId()).stream().map(m -> m.getClassroom().getId()).collect(java.util.stream.Collectors.toSet());
            if(assignments.findBySpaceIdOrderByAssignedAtDesc(sourceSpace).stream().anyMatch(a -> a.getWorksheetRevision().getId().equals(pinned.getId()) && a.getClassroom()!=null && classIds.contains(a.getClassroom().getId()))) throw codeNotFound();
        }
        var assignment=new WorksheetAssignment(UUID.randomUUID(),pinned,null,user); assignment.setSpaceId(sourceSpace);
        spaces.register(assignment,null); assignments.save(assignment);
        return JoinWorksheetResponse.from(responseMapper.toResponse(pinned),assignment.getId());
    }

    private WorksheetRevision publishNonEmpty(Worksheet worksheet) {
        WorksheetRevision revision = revisions.publish(worksheet);
        if (revisionItems.countByRevision_Id(revision.getId()) == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "A worksheet must contain at least one item before it can be shared.");
        }
        return revision;
    }

    private Worksheet requireOwned(Long worksheetId, Long userId) {
        return worksheets.findByIdAndUser_Id(worksheetId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Worksheet not found."));
    }

    private String nextCode() {
        String code;
        do {
            code = codes.generate();
        } while (worksheets.existsByShareCode(code));
        return code;
    }

    private String normalize(String code) {
        if (code == null || code.isBlank()) throw codeNotFound();
        return code.strip().toUpperCase(Locale.ROOT);
    }

    private void requireRole(User user, UserRole role) {
        if (user.getRole() != role) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "This account does not have permission for this action.");
        }
    }

    private ResponseStatusException codeNotFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Worksheet code not found.");
    }
}
