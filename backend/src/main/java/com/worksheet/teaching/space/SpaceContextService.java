package com.worksheet.teaching.space;

import com.worksheet.auth.*;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Transactional
public class SpaceContextService {
    private final SpaceAccess access;
    private final StudentDirectoryService directory;

    public SpaceContextService(SpaceAccess access, StudentDirectoryService directory) {
        this.access = access;
        this.directory = directory;
    }

    public record SpaceView(Long id, String name, boolean owner, boolean manageStudentAccess) {}

    public record Context(
            Long spaceId,
            List<SpaceView> spaces,
            StudentDirectoryService.Student student,
            boolean owner,
            boolean manageStudentAccess) {}

    public Context context(User user, HttpServletRequest request) {
        var options = new ArrayList<SpaceView>();
        if (user.getRole() == UserRole.TEACHER) {
            var memberships = access.teachers.findByUserId(user.getId());
            if (memberships.isEmpty())
                memberships = List.of(access.teacher(access.personal(user).id, user));
            for (var member : memberships) {
                var space =
                        access.spaces.findById(member.spaceId).orElseThrow(SpaceAccess::missing);
                options.add(
                        new SpaceView(
                                space.id,
                                space.name,
                                member.owner,
                                member.owner || member.manageStudentAccess));
            }
        } else {
            var code = request.getSession().getAttribute("auth.studentCode");
            var bound = code instanceof String value ? directory.authenticate(value) : null;
            for (var student : access.students.findByUserId(user.getId()))
                if (student.archivedAt == null && (bound == null || bound.id.equals(student.id))) {
                    var space =
                            access.spaces
                                    .findById(student.spaceId)
                                    .orElseThrow(SpaceAccess::missing);
                    options.add(new SpaceView(space.id, space.name, false, false));
                }
        }
        Long selected = null;
        try {
            selected = access.currentSpace(user);
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            if (ex.getStatusCode().value() != 409 && ex.getStatusCode().value() != 404) throw ex;
            if (ex.getStatusCode().value() == 404 && !options.isEmpty())
                selected = options.getFirst().id();
        }
        final Long id = selected;
        var chosen = options.stream().filter(s -> s.id().equals(id)).findFirst().orElse(null);
        var student =
                id == null
                        ? null
                        : access.students
                                .findBySpaceIdAndUserId(id, user.getId())
                                .map(directory::response)
                                .orElse(null);
        return new Context(
                id,
                options,
                student,
                chosen != null && chosen.owner(),
                chosen != null && chosen.manageStudentAccess());
    }

    public record Selection(Long spaceId) {}

    public Selection select(Selection input, User user, HttpServletRequest request) {
        if (input.spaceId() == null) throw SpaceAccess.missing();
        if (user.getRole() == UserRole.TEACHER) access.teacher(input.spaceId(), user);
        else {
            var code = request.getSession().getAttribute("auth.studentCode");
            if (code instanceof String value
                    && !directory.authenticate(value).spaceId.equals(input.spaceId()))
                throw SpaceAccess.missing();
            access.students
                    .findBySpaceIdAndUserId(input.spaceId(), user.getId())
                    .filter(s -> s.archivedAt == null)
                    .orElseThrow(SpaceAccess::missing);
        }
        request.getSession().setAttribute("auth.spaceId", input.spaceId());
        return new Selection(input.spaceId());
    }

    public void rename(Long spaceId, String name, User actor) {
        access.owner(spaceId, actor);
        if (name == null || name.isBlank() || name.strip().length() > 150)
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Enter a space name (1–150 characters).");
        access.spaces.findById(spaceId).orElseThrow(SpaceAccess::missing).name = name.strip();
    }
}
