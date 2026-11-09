package com.worksheet.content.api;

/** A draft item with historic results cannot be physically deleted. */
public interface ItemResultUsage {
    boolean hasRecordedResults(Long itemId);
}
