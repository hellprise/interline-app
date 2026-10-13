import { describe, expect, it } from "vitest";
import { expectedFlightKey } from "./index.ts";

describe("expectedFlightKey", () => {
  it("preserves UTC date for late evening departures (23:30Z)", () => {
    expect(
      expectedFlightKey({
        airline_code: "AA",
        flight_number: "123",
        dep_time_utc: "2026-11-02T23:30:00Z",
      }),
    ).toBe("AA-123-2026-11-02");
  });

  it("handles airline codes ending with a digit", () => {
    expect(
      expectedFlightKey({
        airline_code: "Q7",
        flight_number: "123",
        dep_time_utc: "2026-10-13T00:00:00Z",
      }),
    ).toBe("Q7-123-2026-10-13");
  });
});
