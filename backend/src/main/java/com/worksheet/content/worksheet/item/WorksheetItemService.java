package com.worksheet.content.worksheet.item;

import com.worksheet.content.api.ItemResultUsage;
import com.worksheet.content.catalog.JsonSchemaValidationService;
import com.worksheet.content.catalog.MiniGameDefinition;
import com.worksheet.content.catalog.MiniGameDefinitionRepository;
import com.worksheet.content.catalog.MiniGameDefinitionService;
import com.worksheet.content.catalog.asset.ImageSlotService;
import com.worksheet.content.worksheet.Worksheet;
import com.worksheet.content.worksheet.WorksheetRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;

import java.util.List;

@Service
public class WorksheetItemService {
    private final MiniGameDefinitionService definitions;
    private final WorksheetItemRepository repository;
    private final WorksheetRepository worksheetRepository;
    private final MiniGameDefinitionRepository miniGameRepository;
    private final ItemResultUsage recordedResults;
    private final JsonSchemaValidationService schemaValidator;
    private final ImageSlotService imageSlots;

    public WorksheetItemService(
            WorksheetItemRepository repository,
            WorksheetRepository worksheetRepository,
            MiniGameDefinitionRepository miniGameRepository,
            ItemResultUsage recordedResults,
            JsonSchemaValidationService schemaValidator,
            ImageSlotService imageSlots,
            MiniGameDefinitionService definitions) {
        this.definitions = definitions;
        this.repository = repository;
        this.worksheetRepository = worksheetRepository;
        this.miniGameRepository = miniGameRepository;
        this.recordedResults = recordedResults;
        this.schemaValidator = schemaValidator;
        this.imageSlots = imageSlots;
    }

    @Transactional
    public WorksheetItemResponse create(
            Long worksheetId, Long userId, CreateWorksheetItemRequest request) {
        Worksheet worksheet =
                worksheetRepository
                        .findByIdAndUser_Id(worksheetId, userId)
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND, "Worksheet not found."));
        MiniGameDefinition miniGame =
                miniGameRepository
                        .findById(request.miniGameId())
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND, "Mini-game not found."));
        requireActive(miniGame);

        JsonNode configuration =
                request.configuration() != null
                        ? request.configuration()
                        : miniGame.getDefaultConfiguration().deepCopy();
        schemaValidator.validate(
                miniGame.getConfigurationSchema(), configuration, "Mini-game configuration");

        var imageAssets = imageSlots.resolve(miniGame, configuration, userId);
        WorksheetItem item =
                new WorksheetItem(worksheet, miniGame, request.orderIndex(), configuration);
        item.replaceImageAssets(imageAssets);
        repository.save(item);
        return toResponse(item);
    }

    @Transactional(readOnly = true)
    public List<WorksheetItemResponse> getAll(Long worksheetId, Long userId) {
        if (worksheetRepository.findByIdAndUser_Id(worksheetId, userId).isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Worksheet not found.");

        return repository
                .findByWorksheet_IdAndWorksheet_User_IdOrderByOrderIndex(worksheetId, userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public WorksheetItemResponse update(
            Long worksheetId, Long itemId, Long userId, CreateWorksheetItemRequest request) {
        WorksheetItem item = requireOwned(worksheetId, itemId, userId);
        MiniGameDefinition miniGame =
                miniGameRepository
                        .findById(request.miniGameId())
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND, "Mini-game not found."));
        if (!miniGame.getId().equals(item.getMiniGame().getId())) requireActive(miniGame);
        JsonNode configuration =
                request.configuration() != null
                        ? request.configuration()
                        : miniGame.getDefaultConfiguration().deepCopy();
        schemaValidator.validate(
                miniGame.getConfigurationSchema(), configuration, "Mini-game configuration");

        item.update(miniGame, request.orderIndex(), configuration);
        item.replaceImageAssets(imageSlots.resolve(miniGame, configuration, userId));
        return toResponse(repository.save(item));
    }

    @Transactional
    public void delete(Long worksheetId, Long itemId, Long userId) {
        WorksheetItem item = requireOwned(worksheetId, itemId, userId);
        if (recordedResults.hasRecordedResults(itemId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Worksheet item has saved results and cannot be deleted.");
        }
        repository.delete(item);
    }

    private WorksheetItem requireOwned(Long worksheetId, Long itemId, Long userId) {
        return repository
                .findByIdAndWorksheet_IdAndWorksheet_User_Id(itemId, worksheetId, userId)
                .orElseThrow(
                        () ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND, "Worksheet item not found."));
    }

    private void requireActive(MiniGameDefinition miniGame) {
        if (!miniGame.isActive()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Mini-game version is inactive.");
        }
    }

    private WorksheetItemResponse toResponse(WorksheetItem item) {
        return new WorksheetItemResponse(
                item.getId(),
                item.getWorksheet().getId(),
                item.getMiniGame().getId(),
                item.getOrderIndex(),
                item.getConfiguration(),
                definitions.toResponse(item.getMiniGame()));
    }
}
