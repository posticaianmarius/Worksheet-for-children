package com.worksheet.teaching.classroom;

public record StudentNameRequest(String name, Long studentId, Boolean allowDuplicate) {
    public StudentNameRequest(String name) {
        this(name, null, false);
    }
}
