package com.worksheet.learning.legacy.result;

import com.worksheet.content.worksheet.Worksheet;
import com.worksheet.learning.legacy.result.minigame.MiniGameResultRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@Transactional
public class WorksheetResultService {
    private final com.worksheet.content.api.WorksheetContent content;
    private final WorksheetResultRepository repository;
    private final MiniGameResultRepository miniGameResultRepository;

    public WorksheetResultService(
            WorksheetResultRepository repository,
            MiniGameResultRepository miniGameResultRepository,
            com.worksheet.content.api.WorksheetContent content) {
        this.content = content;
        this.repository = repository;
        this.miniGameResultRepository = miniGameResultRepository;
    }

    public WorksheetResultResponse create(
            Long worksheetId, Long userId, CreateWorksheetResultRequest request) {
        Worksheet worksheet =
                content.ownedDraft(worksheetId, userId)
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND, "Worksheet not found."));

        validateScores(request);

        WorksheetResult result =
                repository.save(
                        new WorksheetResult(worksheet, request.totalScore(), request.maxScore()));
        return toResponse(result);
    }

    public List<WorksheetResultResponse> getAll(Long worksheetId, Long userId) {
        if (content.ownedDraft(worksheetId, userId).isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Worksheet not found.");

        return repository
                .findByWorksheet_IdAndWorksheet_User_IdAndAssignmentIsNullOrderByCompletedAtDesc(
                        worksheetId, userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public WorksheetResultResponse update(
            Long worksheetId, Long resultId, Long userId, CreateWorksheetResultRequest request) {
        WorksheetResult result = requireOwned(worksheetId, resultId, userId);
        validateScores(request);
        result.updateScores(request.totalScore(), request.maxScore());
        return toResponse(repository.save(result));
    }

    @Transactional
    public void delete(Long worksheetId, Long resultId, Long userId) {
        WorksheetResult result = requireOwned(worksheetId, resultId, userId);
        miniGameResultRepository.deleteAllByWorksheetResultId(resultId);
        repository.delete(result);
    }

    private WorksheetResult requireOwned(Long worksheetId, Long resultId, Long userId) {
        return repository
                .findByIdAndWorksheet_IdAndWorksheet_User_IdAndAssignmentIsNull(
                        resultId, worksheetId, userId)
                .orElseThrow(
                        () ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND, "Worksheet result not found."));
    }

    private void validateScores(CreateWorksheetResultRequest request) {
        if (request.totalScore() < 0)
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Total score cannot be negative.");
        if (request.maxScore() < 0)
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Max score cannot be negative.");
        if (request.totalScore() > request.maxScore())
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Total score cannot exceed max score.");
    }

    private WorksheetResultResponse toResponse(WorksheetResult result) {
        Long assignmentId = result.getAssignment() == null ? null : result.getAssignment().getId();
        return new WorksheetResultResponse(
                result.getId(),
                result.getWorksheet().getId(),
                assignmentId,
                result.getTotalScore(),
                result.getMaxScore(),
                result.getCompletedAt());
    }
}
