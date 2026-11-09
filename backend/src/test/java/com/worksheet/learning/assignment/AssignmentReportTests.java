package com.worksheet.learning.assignment;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.worksheet.auth.User;
import com.worksheet.auth.UserRepository;
import com.worksheet.auth.UserRole;
import com.worksheet.content.worksheet.Worksheet;
import com.worksheet.content.worksheet.WorksheetRepository;
import com.worksheet.content.worksheet.revision.WorksheetRevision;
import com.worksheet.content.worksheet.revision.WorksheetRevisionRepository;
import com.worksheet.learning.attempt.WorksheetAttempt;
import com.worksheet.learning.attempt.WorksheetAttemptRepository;
import com.worksheet.learning.legacy.result.WorksheetResult;
import com.worksheet.learning.legacy.result.WorksheetResultRepository;
import com.worksheet.teaching.classroom.Classroom;
import com.worksheet.teaching.classroom.ClassroomRepository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:assignment-report-test;DB_CLOSE_DELAY=-1",
            "spring.flyway.enabled=false",
            "spring.jpa.hibernate.ddl-auto=create-drop"
        })
@AutoConfigureMockMvc
@Transactional
class AssignmentReportTests {
    @Autowired MockMvc mvc;
    @Autowired com.worksheet.learning.api.LearningAccess learning;
    @Autowired UserRepository users;
    @Autowired ClassroomRepository classrooms;
    @Autowired WorksheetRepository worksheets;
    @Autowired WorksheetRevisionRepository revisions;
    @Autowired WorksheetAssignmentRepository assignments;
    @Autowired WorksheetAttemptRepository attempts;
    @Autowired WorksheetResultRepository results;

    @Test
    void reportsLatestCompletedScoreIncludingZeroAndKeepsUnstartedScoresEmpty() throws Exception {
        User teacher = user("Teacher", UserRole.TEACHER);
        var revision = revision(teacher);
        var classroom =
                classrooms.save(
                        new Classroom(
                                teacher, "Clasa A", UUID.randomUUID().toString().substring(0, 8)));
        var completed = assign(revision, classroom, "Ana");
        var first = new WorksheetAttempt(revision, completed);
        first.complete(10, 10);
        attempts.save(first);
        var latest = new WorksheetAttempt(revision, completed);
        latest.complete(0, 10);
        attempts.save(latest);
        attempts.save(new WorksheetAttempt(revision, completed));
        var unstarted = assign(revision, classroom, "Dan");
        var progress = assign(revision, classroom, "Mara");
        attempts.save(new WorksheetAttempt(revision, progress));
        var revoked = assign(revision, classroom, "Paul");
        revoked.revoke();
        // Another teacher's assignments must never enter the report.
        var otherRevision = revision(user("Other teacher", UserRole.TEACHER));
        otherRevision.getWorksheet().share("OTHR2345", otherRevision);
        assign(otherRevision, null, "Other student");
        var rows = "$[?(@.assignmentId == " + completed.getId() + ")]";
        mvc.perform(get("/api/assignments/report").session(session(teacher)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath(rows + ".classroomName").value(hasSize(1)))
                .andExpect(jsonPath(rows + ".status").value(contains("COMPLETED")))
                .andExpect(jsonPath(rows + ".totalScore").value(contains(0)))
                .andExpect(jsonPath(rows + ".maxScore").value(contains(10)))
                .andExpect(jsonPath(rows + ".attemptId").value(contains(latest.getId().intValue())))
                .andExpect(jsonPath(rows + ".worksheetCode").value(contains("ABCD2345")))
                .andExpect(
                        jsonPath("$[?(@.assignmentId == " + unstarted.getId() + ")].status")
                                .value(contains("NOT_STARTED")))
                .andExpect(
                        jsonPath("$[?(@.assignmentId == " + unstarted.getId() + ")].totalScore")
                                .value(contains(nullValue())))
                .andExpect(
                        jsonPath("$[?(@.assignmentId == " + progress.getId() + ")].status")
                                .value(contains("IN_PROGRESS")))
                .andExpect(
                        jsonPath("$[?(@.assignmentId == " + revoked.getId() + ")].status")
                                .value(contains("REVOKED")));
    }

    @Test
    void hidesCodesForDifferentVersionsAndIncludesLegacyResults() throws Exception {
        User teacher = user("Teacher", UserRole.TEACHER);
        var original = revision(teacher);
        var assignment = assign(original, null, "Ana");
        results.save(new WorksheetResult(original.getWorksheet(), assignment, 0, 5));
        var updated =
                revisions.save(
                        new WorksheetRevision(
                                original.getWorksheet(), 2, "New worksheet", "b".repeat(64)));
        original.getWorksheet().share("NEWC2345", updated);
        mvc.perform(get("/api/assignments/report").session(session(teacher)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].classroomId").value(nullValue()))
                .andExpect(jsonPath("$[0].worksheetName").value("Numbers"))
                .andExpect(jsonPath("$[0].worksheetCode").value(nullValue()))
                .andExpect(jsonPath("$[0].codeStatus").value("VERSION_CHANGED"))
                .andExpect(jsonPath("$[0].status").value("COMPLETED"))
                .andExpect(jsonPath("$[0].totalScore").value(0))
                .andExpect(jsonPath("$[0].attemptId").value(nullValue()));
    }

    @Test
    void rejectsStudentsAndAnonymousVisitorsAndAllowsEmptyTeacherReport() throws Exception {
        mvc.perform(get("/api/assignments/report")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/assignments/report").session(session(user("Child", UserRole.USER))))
                .andExpect(status().isForbidden());
        mvc.perform(
                        get("/api/assignments/report")
                                .session(session(user("Teacher", UserRole.TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    private User user(String name, UserRole role) {
        return users.save(new User(name, UUID.randomUUID() + "@example.com", "!", role));
    }

    private WorksheetRevision revision(User teacher) {
        var worksheet = worksheets.save(new Worksheet("Numbers", teacher));
        var revision =
                revisions.save(new WorksheetRevision(worksheet, 1, "Numbers", "a".repeat(64)));
        worksheet.share("ABCD2345", revision);
        return revision;
    }

    private WorksheetAssignment assign(
            WorksheetRevision revision, Classroom classroom, String name) {
        var assignment =
                new WorksheetAssignment(
                        UUID.randomUUID(), revision, classroom, user(name, UserRole.USER));
        learning.assignmentSpace(assignment);
        return assignments.save(assignment);
    }

    private MockHttpSession session(User user) {
        var session = new MockHttpSession();
        session.setAttribute("auth.userId", user.getId());
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(
                        user.getId().toString(),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))));
        session.setAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        return session;
    }
}
