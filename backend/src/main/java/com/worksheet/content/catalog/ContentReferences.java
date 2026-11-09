package com.worksheet.content.catalog;

public interface ContentReferences {
    boolean definitionInUse(Long id);

    boolean assetInUse(Long id);
}
