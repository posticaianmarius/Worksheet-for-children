package com.worksheet.auth;

/** Domain modules validate revocable code credentials without owning session handling. */
public interface CodeSessionValidator {
    boolean isValid(Long userId, String code);
}
