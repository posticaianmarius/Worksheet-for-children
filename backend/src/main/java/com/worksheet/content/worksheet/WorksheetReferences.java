package com.worksheet.content.worksheet;

import com.worksheet.content.catalog.ContentReferences;
import com.worksheet.content.worksheet.item.WorksheetItemRepository;
import com.worksheet.content.worksheet.revision.WorksheetRevisionItemRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WorksheetReferences implements ContentReferences {
    private final WorksheetItemRepository drafts;
    private final WorksheetRevisionItemRepository revisions;

    public WorksheetReferences(
            WorksheetItemRepository drafts, WorksheetRevisionItemRepository revisions) {
        this.drafts = drafts;
        this.revisions = revisions;
    }

    public boolean definitionInUse(Long id) {
        return drafts.existsByMiniGame_Id(id) || revisions.existsByMiniGameDefinition_Id(id);
    }

    public boolean assetInUse(Long id) {
        return drafts.existsByImageAssets_Id(id) || revisions.existsByImageAssets_Id(id);
    }
}
