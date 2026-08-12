/**
 * Global test setup for frontend API tests.
 * Runs before every test file via vitest setupFiles.
 */
import { afterEach, vi } from "vitest";

// Reset all mocks between tests so state doesn't bleed across test cases.
afterEach(() => {
  vi.resetAllMocks();
});
