package com.worksheet.worksheet;

import com.worksheet.auth.AuthSessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/worksheets")
public class WorksheetController {
    private final WorksheetService worksheets;
    private final WorksheetShareService shares;
    private final AuthSessionService sessions;

    public WorksheetController(WorksheetService worksheets, WorksheetShareService shares,
                               AuthSessionService sessions) {
        this.worksheets = worksheets;
        this.shares = shares;
        this.sessions = sessions;
    }

    @GetMapping
    public List<WorksheetResponse> getAll(HttpServletRequest request) {
        return worksheets.getAll(sessions.requireUserId(request));
    }

    @GetMapping("/{id}")
    public WorksheetResponse getById(@PathVariable Long id, HttpServletRequest request) {
        return worksheets.getById(id, sessions.requireUserId(request));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorksheetResponse create(@RequestBody CreateWorksheetRequest input,
                                    HttpServletRequest request) {
        return worksheets.create(sessions.requireWorksheetEditor(request).getId(), input);
    }

    @PutMapping("/{id}")
    public WorksheetResponse update(@PathVariable Long id, @RequestBody CreateWorksheetRequest input,
                                    HttpServletRequest request) {
        return worksheets.update(id, sessions.requireWorksheetEditor(request).getId(), input);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, HttpServletRequest request) {
        worksheets.delete(id, sessions.requireWorksheetEditor(request).getId());
    }

    @PostMapping("/{id}/share")
    public WorksheetShareResponse share(@PathVariable Long id, HttpServletRequest request) {
        return new WorksheetShareResponse(shares.share(id, sessions.requireUser(request)));
    }

    @PostMapping("/{id}/share/rotate")
    public WorksheetShareResponse rotateShareCode(@PathVariable Long id, HttpServletRequest request) {
        return new WorksheetShareResponse(shares.rotate(id, sessions.requireUser(request)));
    }

    @PostMapping("/join/choices")
    public java.util.List<WorksheetShareService.Choice> choices(@RequestBody JoinWorksheetRequest input,HttpServletRequest request) { return shares.choices(input.code(),sessions.requireUser(request)); }

    @PostMapping("/join")
    public JoinWorksheetResponse joinByCode(@Valid @RequestBody JoinWorksheetRequest input,
                                            HttpServletRequest request) {
        return shares.join(input.code(), sessions.requireUser(request));
    }
}
