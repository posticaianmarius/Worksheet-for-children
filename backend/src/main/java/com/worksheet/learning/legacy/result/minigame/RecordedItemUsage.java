package com.worksheet.learning.legacy.result.minigame;

import com.worksheet.content.api.ItemResultUsage;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecordedItemUsage implements ItemResultUsage {
    private final MiniGameResultRepository results;

    public RecordedItemUsage(MiniGameResultRepository results) {
        this.results = results;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasRecordedResults(Long itemId) {
        return results.existsByWorksheetItem_Id(itemId);
    }
}
