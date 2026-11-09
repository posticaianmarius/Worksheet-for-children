package com.worksheet.shared.storage;

public interface MiniGameAssetStorage {
    void store(String storageKey, byte[] content);

    byte[] load(String storageKey);

    void delete(String storageKey);
}
