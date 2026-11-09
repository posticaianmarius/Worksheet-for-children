package com.worksheet.learning.sharing;

import com.worksheet.content.worksheet.*;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record JoinWorksheetRequest(
        @NotBlank(message = "Worksheet code is required.")
                @Size(max = 9, message = "Worksheet code is too long.")
                String code) {}
