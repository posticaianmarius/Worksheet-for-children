package com.worksheet.classroom;
public record StudentNameRequest(String name, Long studentId, Boolean allowDuplicate) {
 public StudentNameRequest(String name) { this(name,null,false); }
}
