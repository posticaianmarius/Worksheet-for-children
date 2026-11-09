package com.worksheet.learning.legacy.result.minigame;

import com.worksheet.content.catalog.JsonSchemaValidationService;
import com.worksheet.content.worksheet.item.WorksheetItem;
import com.worksheet.learning.legacy.result.WorksheetResult;
import com.worksheet.learning.legacy.result.WorksheetResultRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;

import java.util.List;

@Service
@Transactional
public class MiniGameResultService {
    private final com.worksheet.content.api.WorksheetContent content;
    private final com.worksheet.learning.api.LearningAccess learning;
    private final com.worksheet.teaching.space.SpaceAccess spaces;
    private final com.worksheet.auth.api.UserAccounts users;
    private final MiniGameResultRepository repository;
    private final WorksheetResultRepository worksheetResultRepository;
    private final JsonSchemaValidationService schemaValidator;

    public MiniGameResultService(
            MiniGameResultRepository repository,
            WorksheetResultRepository worksheetResultRepository,
            JsonSchemaValidationService schemaValidator,
            com.worksheet.teaching.space.SpaceAccess spaces,
            com.worksheet.auth.api.UserAccounts users,
            com.worksheet.learning.api.LearningAccess learning,
            com.worksheet.content.api.WorksheetContent content) {
        this.content = content;
        this.learning = learning;
        this.spaces = spaces;
        this.users = users;
        this.repository = repository;
        this.worksheetResultRepository = worksheetResultRepository;
        this.schemaValidator = schemaValidator;
    }

    public MiniGameResultResponse create(
            Long worksheetResultId, Long userId, CreateMiniGameResultRequest request) {
        WorksheetResult worksheetResult = requireResultAccess(worksheetResultId, userId, true);

        validate(request);

        WorksheetItem worksheetItem =
                content.draftItem(request.worksheetItemId(), worksheetResult.getWorksheet().getId())
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND, "Worksheet item not found."));

        JsonNode details =
                request.details() != null
                        ? request.details()
                        : JsonNodeFactory.instance.objectNode();
        schemaValidator.validate(
                worksheetItem.getMiniGame().getResultSchema(), details, "Mini-game result details");

        MiniGameResult result =
                repository.save(
                        new MiniGameResult(
                                worksheetResult,
                                worksheetItem,
                                request.score(),
                                request.maxScore(),
                                request.timeSeconds(),
                                details));
        return toResponse(result);
    }

    public List<MiniGameResultResponse> getAll(Long worksheetResultId, Long userId) {
        requireResultAccess(worksheetResultId, userId, false);

        return repository
                .findByWorksheetResult_IdOrderByWorksheetItem_OrderIndex(worksheetResultId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public MiniGameResultResponse update(
            Long worksheetResultId,
            Long miniGameResultId,
            Long userId,
            CreateMiniGameResultRequest request) {
        MiniGameResult result = requireOwned(worksheetResultId, miniGameResultId, userId);
        validate(request);
        WorksheetItem worksheetItem =
                content.draftItem(
                                request.worksheetItemId(),
                                result.getWorksheetResult().getWorksheet().getId())
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND, "Worksheet item not found."));
        JsonNode details =
                request.details() != null
                        ? request.details()
                        : JsonNodeFactory.instance.objectNode();
        schemaValidator.validate(
                worksheetItem.getMiniGame().getResultSchema(), details, "Mini-game result details");

        result.update(
                worksheetItem, request.score(), request.maxScore(), request.timeSeconds(), details);
        return toResponse(repository.save(result));
    }

    public void delete(Long worksheetResultId, Long miniGameResultId, Long userId) {
        repository.delete(requireOwned(worksheetResultId, miniGameResultId, userId));
    }

    private MiniGameResult requireOwned(
            Long worksheetResultId, Long miniGameResultId, Long userId) {
        requireResultAccess(worksheetResultId, userId, true);
        return repository
                .findByIdAndWorksheetResult_Id(miniGameResultId, worksheetResultId)
                .orElseThrow(
                        () ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND, "Mini-game result not found."));
    }

    private WorksheetResult requireResultAccess(
            Long worksheetResultId, Long userId, boolean write) {
        WorksheetResult result =
                worksheetResultRepository
                        .findById(worksheetResultId)
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Worksheet result not found."));
        if (result.getAssignment() == null) {
            if (!result.getWorksheet().getUser().getId().equals(userId)) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Worksheet result not found.");
            }
            return result;
        }
        var actor =
                users.findById(userId)
                        .orElseThrow(com.worksheet.teaching.space.SpaceAccess::missing);
        if (write
                ? !learning.canWrite(result.getAssignment(), actor)
                : !learning.canRead(result.getAssignment(), actor))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Worksheet result not found.");
        return result;
    }

    private void validate(CreateMiniGameResultRequest request) {
        if (request.score() < 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Score cannot be negative.");
        if (request.maxScore() < 0)
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Max score cannot be negative.");
        if (request.score() > request.maxScore())
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Score cannot exceed max score.");
        if (request.timeSeconds() < 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Time cannot be negative.");
    }

    private MiniGameResultResponse toResponse(MiniGameResult result) {
        return new MiniGameResultResponse(
                result.getId(),
                result.getWorksheetResult().getId(),
                result.getWorksheetItem().getId(),
                result.getScore(),
                result.getMaxScore(),
                result.getTimeSeconds(),
                result.getDetails());
    }
}
