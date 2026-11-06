package com.worksheet.classroom;

import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Limit failed code guesses; successful sign-ins on a shared classroom network are not counted. */
@Component
public class StudentSignInLimiter {
    private record Window(long started, int failures) {}
    private final Map<String, Window> failures = new HashMap<>();
    private static final long WINDOW = java.time.Duration.ofMinutes(5).toNanos();
    public synchronized void check(String address) {
        var window = failures.get(address);
        if (window != null && System.nanoTime() - window.started() < WINDOW && window.failures() >= 20) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many unsuccessful attempts. Try again in a few minutes.");
        }
    }
    public synchronized void failed(String address) {
        long now = System.nanoTime();
        failures.entrySet().removeIf(entry -> now - entry.getValue().started() >= WINDOW);
        if (failures.size() >= 10_000 && !failures.containsKey(address)) return;
        failures.compute(address, (key, value) -> value == null ? new Window(now, 1) : new Window(value.started(), value.failures() + 1));
    }
}
