package com.worksheet.content.api;

import static org.springframework.http.HttpStatus.*;

import com.worksheet.auth.User;
import com.worksheet.auth.UserRole;
import com.worksheet.content.worksheet.*;
import com.worksheet.content.worksheet.item.*;
import com.worksheet.content.worksheet.revision.*;
import com.worksheet.shared.codes.JoinCodeGenerator;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

/** Content persistence and publication operations for learning workflows. */
@Service
@Transactional
public class WorksheetContent {
    private final WorksheetRepository worksheets;
    private final WorksheetRevisionRepository revisions;
    private final WorksheetRevisionItemRepository revisionItems;
    private final WorksheetItemRepository items;
    private final WorksheetRevisionService publications;
    private final WorksheetRevisionResponseMapper responses;
    private final JoinCodeGenerator codes;

    public WorksheetContent(
            WorksheetRepository worksheets,
            WorksheetRevisionRepository revisions,
            WorksheetRevisionItemRepository revisionItems,
            WorksheetItemRepository items,
            WorksheetRevisionService publications,
            WorksheetRevisionResponseMapper responses,
            JoinCodeGenerator codes) {
        this.worksheets = worksheets;
        this.revisions = revisions;
        this.revisionItems = revisionItems;
        this.items = items;
        this.publications = publications;
        this.responses = responses;
        this.codes = codes;
    }

    public Optional<Worksheet> ownedDraft(Long id, Long ownerId) {
        return worksheets.findByIdAndUser_Id(id, ownerId);
    }

    public Optional<Worksheet> byShareCode(String code) {
        return worksheets.findByShareCode(code);
    }

    public Optional<WorksheetRevision> revision(Long id) {
        return revisions.findById(id);
    }

    public Optional<WorksheetRevisionItem> revisionItem(Long id, Long revisionId) {
        return revisionItems.findByIdAndRevision_Id(id, revisionId);
    }

    public java.util.List<WorksheetRevisionItem> revisionItems(Long revisionId) {
        return revisionItems.findByRevision_IdOrderByOrderIndex(revisionId);
    }

    public long revisionSize(Long id) {
        return revisionItems.countByRevision_Id(id);
    }

    public Optional<WorksheetItem> draftItem(Long id, Long worksheetId) {
        return items.findByIdAndWorksheet_Id(id, worksheetId);
    }

    public WorksheetRevision publish(Worksheet draft) {
        return publications.publish(draft);
    }

    public WorksheetResponse snapshot(WorksheetRevision revision) {
        return responses.toResponse(revision);
    }

    public enum ShareMode {
        EXISTING,
        REPLACE,
        CURRENT
    }

    public String share(Long id, User teacher, ShareMode mode) {
        if (teacher.getRole() != UserRole.TEACHER)
            throw new ResponseStatusException(
                    FORBIDDEN, "This account does not have permission for this action.");
        var draft =
                ownedDraft(id, teacher.getId())
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                NOT_FOUND, "Worksheet not found."));
        if (mode == ShareMode.EXISTING
                && draft.getShareCode() != null
                && draft.getShareRevision() != null) return draft.getShareCode();
        if (mode == ShareMode.REPLACE) draft.share(nextCode(), publishNonEmpty(draft));
        else {
            String code = draft.getShareCode() == null ? nextCode() : draft.getShareCode();
            draft.share(code, publishNonEmpty(draft));
        }
        worksheets.save(draft);
        return draft.getShareCode();
    }

    public WorksheetRevision ensureSharedRevision(Worksheet draft) {
        if (draft.getShareRevision() == null)
            draft.share(draft.getShareCode(), publishNonEmpty(draft));
        return draft.getShareRevision();
    }

    private WorksheetRevision publishNonEmpty(Worksheet draft) {
        var revision = publications.publish(draft);
        if (revisionSize(revision.getId()) == 0)
            throw new ResponseStatusException(
                    CONFLICT,
                    "A worksheet must contain at least one item before it can be shared.");
        return revision;
    }

    private String nextCode() {
        String code;
        do {
            code = codes.generate();
        } while (worksheets.existsByShareCode(code));
        return code;
    }
}
