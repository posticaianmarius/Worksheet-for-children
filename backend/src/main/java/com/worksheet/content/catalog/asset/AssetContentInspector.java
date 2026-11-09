package com.worksheet.content.catalog.asset;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Component
public class AssetContentInspector {
    private static final Map<String, String> EXTENSIONS =
            Map.of(
                    "image/png",
                    ".png",
                    "image/jpeg",
                    ".jpg",
                    "image/gif",
                    ".gif",
                    "image/webp",
                    ".webp",
                    "audio/mpeg",
                    ".mp3",
                    "audio/ogg",
                    ".ogg",
                    "audio/wav",
                    ".wav");

    public InspectedAsset inspect(byte[] bytes) {
        String type = detect(bytes);
        String extension = EXTENSIONS.get(type);
        if (extension == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Only PNG, JPEG, GIF, WebP, MP3, OGG, and WAV assets are supported.");
        }
        return new InspectedAsset(type, extension);
    }

    private String detect(byte[] b) {
        if (starts(b, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return "image/png";
        if (starts(b, 0xFF, 0xD8, 0xFF)) return "image/jpeg";
        if (ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a")) return "image/gif";
        if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return "image/webp";
        if (ascii(b, 0, "OggS")) return "audio/ogg";
        if (ascii(b, 0, "RIFF") && ascii(b, 8, "WAVE")) return "audio/wav";
        if (ascii(b, 0, "ID3") || (b.length > 1 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xE0) == 0xE0))
            return "audio/mpeg";
        return "application/octet-stream";
    }

    private boolean ascii(byte[] bytes, int offset, String value) {
        if (bytes.length < offset + value.length()) return false;
        for (int i = 0; i < value.length(); i++)
            if ((char) bytes[offset + i] != value.charAt(i)) return false;
        return true;
    }

    private boolean starts(byte[] bytes, int... signature) {
        if (bytes.length < signature.length) return false;
        for (int i = 0; i < signature.length; i++)
            if ((bytes[i] & 0xFF) != signature[i]) return false;
        return true;
    }

    public record InspectedAsset(String contentType, String extension) {}
}
