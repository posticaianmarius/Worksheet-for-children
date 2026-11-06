package com.worksheet.attempt;

import com.worksheet.assignment.WorksheetAssignment;
import com.worksheet.assignment.WorksheetAssignmentRepository;
import com.worksheet.auth.User;
import com.worksheet.auth.UserRole;
import com.worksheet.minigame.JsonSchemaValidationService;
import com.worksheet.minigame.MiniGameDefinitionService;
import com.worksheet.worksheet.Worksheet;
import com.worksheet.worksheet.WorksheetRepository;
import com.worksheet.worksheet.revision.WorksheetRevision;
import com.worksheet.worksheet.revision.WorksheetRevisionItem;
import com.worksheet.worksheet.revision.WorksheetRevisionItemRepository;
import com.worksheet.worksheet.revision.WorksheetRevisionService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;

@Service
public class WorksheetAttemptService {
    private final com.worksheet.space.SpaceAccess spaces;
    private final MiniGameDefinitionService definitions;
    private final WorksheetAttemptRepository attempts;
    private final WorksheetAttemptItemResultRepository results;
    private final WorksheetRepository worksheets;
    private final WorksheetAssignmentRepository assignments;
    private final WorksheetRevisionService revisionService;
    private final WorksheetRevisionItemRepository revisionItems;
    private final JsonSchemaValidationService schemaValidator;

    public WorksheetAttemptService(WorksheetAttemptRepository attempts,
                                   WorksheetAttemptItemResultRepository results,
                                   WorksheetRepository worksheets,
                                   WorksheetAssignmentRepository assignments,
                                   WorksheetRevisionService revisionService,
                                   WorksheetRevisionItemRepository revisionItems,
                                   JsonSchemaValidationService schemaValidator,
                                   MiniGameDefinitionService definitions,com.worksheet.space.SpaceAccess spaces) {
        this.spaces=spaces;
        this.definitions = definitions;
        this.attempts = attempts;
        this.results = results;
        this.worksheets = worksheets;
        this.assignments = assignments;
        this.revisionService = revisionService;
        this.revisionItems = revisionItems;
        this.schemaValidator = schemaValidator;
    }

    @Transactional
    public WorksheetAttemptResponse startPersonal(Long worksheetId, User actor) {
        Worksheet worksheet = worksheets.findByIdAndUser_Id(worksheetId, actor.getId())
            .orElseThrow(() -> notFound("Worksheet"));
        WorksheetRevision revision = revisionService.publish(worksheet);
        requireHasItems(revision);
        return response(attempts.save(new WorksheetAttempt(revision, null)));
    }

    @Transactional
    public WorksheetAttemptResponse startAssigned(Long assignmentId, User actor) {
        if (actor.getRole() != UserRole.USER) throw forbidden();
        WorksheetAssignment assignment = assignments.findById(assignmentId)
            .filter(value -> spaces.canWrite(value,actor))
            .orElseThrow(() -> notFound("Assignment"));
        requireHasItems(assignment.getWorksheetRevision());
        return response(attempts.save(new WorksheetAttempt(assignment.getWorksheetRevision(), assignment)));
    }

    @Transactional(readOnly = true)
    public WorksheetAttemptResponse get(Long attemptId, User actor) {
        return response(requireReadable(attemptId, actor));
    }

    @Transactional(readOnly = true)
    public List<WorksheetAttemptResponse> getPersonal(Long worksheetId, User actor) {
        if (worksheets.findByIdAndUser_Id(worksheetId, actor.getId()).isEmpty()) throw notFound("Worksheet");
        return attempts.findByRevision_Worksheet_IdAndAssignmentIsNullOrderByStartedAtDesc(worksheetId)
            .stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public List<WorksheetAttemptResponse> getAssigned(Long assignmentId, User actor) {
        WorksheetAssignment assignment = requireReadableAssignment(assignmentId, actor);
        return attempts.findByAssignment_IdOrderByStartedAtDesc(assignment.getId())
            .stream()
            .filter(attempt -> actor.getRole()!=UserRole.USER || assignment.getRevokedAt()==null
                || attempt.getStatus()==AttemptStatus.COMPLETED)
            .map(this::response).toList();
    }

    @Transactional
    public AttemptItemResultResponse saveResult(Long attemptId, Long revisionItemId, User actor,
                                                SaveAttemptItemResultRequest request) {
        WorksheetAttempt attempt = requireWritable(attemptId, actor);
        WorksheetRevisionItem item = revisionItems.findByIdAndRevision_Id(revisionItemId, attempt.getRevision().getId())
            .orElseThrow(() -> notFound("Worksheet revision item"));
        validateResult(request);
        JsonNode candidateDetails = request.details() == null ? JsonNodeFactory.instance.objectNode() : request.details();
        if (request.outcome() == ItemResultOutcome.SKIPPED) {
            candidateDetails = JsonNodeFactory.instance.objectNode();
        } else {
            schemaValidator.validate(item.getMiniGameDefinition().getResultSchema(), candidateDetails,
                "Mini-game result details");
        }
        final JsonNode details = candidateDetails;
        WorksheetAttemptItemResult result = results.findByAttempt_IdAndRevisionItem_Id(attemptId, revisionItemId)
            .orElseGet(() -> new WorksheetAttemptItemResult(attempt, item, request.outcome(),
                request.score(), request.maxScore(), request.timeSeconds(), details));
        result.update(request.outcome(), request.score(), request.maxScore(), request.timeSeconds(), details);
        return resultResponse(results.save(result));
    }

    @Transactional
    public WorksheetAttemptResponse complete(Long attemptId, User actor) {
        WorksheetAttempt attempt = requireWritable(attemptId, actor);
        List<WorksheetAttemptItemResult> saved = results.findByAttempt_IdOrderByRevisionItem_OrderIndex(attemptId);
        long expected = revisionItems.countByRevision_Id(attempt.getRevision().getId());
        if (saved.size() != expected) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Every worksheet item must be completed or explicitly skipped.");
        }
        int total = saved.stream().mapToInt(WorksheetAttemptItemResult::getScore).sum();
        int maximum = saved.stream().mapToInt(WorksheetAttemptItemResult::getMaxScore).sum();
        attempt.complete(total, maximum);
        return response(attempts.save(attempt));
    }

    @Transactional
    public void abandonActiveForAssignments(List<WorksheetAssignment> revokedAssignments) {
        for (WorksheetAssignment assignment : revokedAssignments) {
            List<WorksheetAttempt> active = attempts.findByAssignment_IdAndStatus(
                assignment.getId(), AttemptStatus.IN_PROGRESS);
            active.forEach(WorksheetAttempt::abandon);
            attempts.saveAll(active);
        }
    }

    private WorksheetAttempt requireReadable(Long id, User actor) {
        WorksheetAttempt attempt = attempts.findById(id).orElseThrow(() -> notFound("Attempt"));
        if (attempt.getAssignment() == null) {
            if (!attempt.getRevision().getWorksheet().getUser().getId().equals(actor.getId())) throw notFound("Attempt");
            return attempt;
        }
        WorksheetAssignment assignment = attempt.getAssignment();
        if(!spaces.canRead(assignment,actor) || (actor.getRole()==UserRole.USER && assignment.getRevokedAt()!=null && attempt.getStatus()!=AttemptStatus.COMPLETED)) throw notFound("Attempt");
        return attempt;
    }

    private WorksheetAttempt requireWritable(Long id, User actor) {
        WorksheetAttempt attempt = requireReadable(id, actor);
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Attempt is no longer editable.");
        }
        if (attempt.getAssignment() != null && !spaces.canWrite(attempt.getAssignment(),actor)) {
            throw notFound("Attempt");
        }
        return attempt;
    }

    private WorksheetAssignment requireReadableAssignment(Long id, User actor) {
        WorksheetAssignment assignment = assignments.findById(id).orElseThrow(() -> notFound("Assignment"));
        if(!spaces.canRead(assignment,actor)) throw notFound("Assignment");
        return assignment;
    }

    private void validateResult(SaveAttemptItemResultRequest request) {
        if (request.outcome() == null) throw badRequest("Result outcome is required.");
        if (request.score() < 0 || request.maxScore() < 0 || request.score() > request.maxScore()) {
            throw badRequest("Score must be between zero and maxScore.");
        }
        if (request.timeSeconds() < 0) throw badRequest("Time cannot be negative.");
        if (request.outcome() == ItemResultOutcome.SKIPPED && request.score() != 0) {
            throw badRequest("Skipped items must have a score of zero.");
        }
    }

    private void requireHasItems(WorksheetRevision revision) {
        if (revisionItems.countByRevision_Id(revision.getId()) == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Worksheet has no items.");
        }
    }

    private WorksheetAttemptResponse response(WorksheetAttempt attempt) {
        List<AttemptRevisionItemResponse> itemResponses = revisionItems
            .findByRevision_IdOrderByOrderIndex(attempt.getRevision().getId()).stream()
            .map(item -> new AttemptRevisionItemResponse(item.getId(), item.getMiniGameDefinition().getId(),
                item.getOrderIndex(), item.getConfiguration(), definitions.toResponse(item.getMiniGameDefinition())))
            .toList();
        List<AttemptItemResultResponse> resultResponses = results
            .findByAttempt_IdOrderByRevisionItem_OrderIndex(attempt.getId()).stream()
            .map(this::resultResponse).toList();
        Long assignmentId = attempt.getAssignment() == null ? null : attempt.getAssignment().getId();
        return new WorksheetAttemptResponse(attempt.getId(), attempt.getRevision().getWorksheet().getId(),
            attempt.getRevision().getId(), attempt.getRevision().getRevisionNumber(), assignmentId,
            attempt.getStatus(), attempt.getTotalScore(), attempt.getMaxScore(), attempt.getStartedAt(),
            attempt.getCompletedAt(), itemResponses, resultResponses);
    }

    private AttemptItemResultResponse resultResponse(WorksheetAttemptItemResult result) {
        return new AttemptItemResultResponse(result.getId(), result.getRevisionItem().getId(), result.getOutcome(),
            result.getScore(), result.getMaxScore(), result.getTimeSeconds(), result.getDetails());
    }

    private ResponseStatusException notFound(String resource) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, resource + " not found.");
    }

    private ResponseStatusException forbidden() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, "This account does not have permission for this action.");
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
