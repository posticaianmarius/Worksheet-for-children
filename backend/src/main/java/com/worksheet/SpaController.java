package com.worksheet;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {

    @GetMapping({"/login", "/signup", "/invite", "/students", "/space", "/work/{batchId}", "/home", "/home/{legacyName}", "/account", "/sheets",
        "/student", "/student/finished", "/student/settings", "/results", "/classes/{id}/access-cards",
        "/teacher", "/teacher/{id}", "/kids", "/kids/{id}", "/classes", "/classes/{id}",
        "/assignments", "/assignments/{id}", "/assignments/classes/{classId}",
        "/assignments/classes/{classId}/worksheets/{revisionId}", "/attempts/{id}", "/home/{className}/{kidName}",
        "/classes/{id}/children/{userId}", "/classes/{id}/children/{userId}/tests/{attemptId}"})
    public String reactRoutes() {
        return "forward:/index.html";
    }
}
