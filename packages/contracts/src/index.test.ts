import { describe, it, expect } from "vitest";
import { formatFlightKey } from "./index.ts";

describe("formatFlightKey", () => {
  it("returns the standard format", () => {
    expect(
      formatFlightKey({
        airline: "AA",
        number: 123,
        date: "2026-10-13",
      }),
    ).toBe("BROKEN");
  });

  it("returns the format with number in code", () => {
    expect(
      formatFlightKey({
        airline: "Q7",
        number: 123,
        date: "2026-10-13",
      }),
    ).toBe("Q7-123-2026-10-13");
  });
});
