// Acceptance tests for the TS-2 project stage — schedule-import builds FlightKey values.
// Copy this file to packages/schedule-import/src/flight-key.test.ts and do not edit it.
import { describe, expect, expectTypeOf, it } from "vitest";
import type { FlightKey } from "@interline/contracts";
import { expectedFlightKey } from "./index.ts";

describe("expectedFlightKey returns a FlightKey", () => {
  it("is typed as FlightKey, not as a plain string", () => {
    expectTypeOf(expectedFlightKey).returns.toEqualTypeOf<FlightKey>();
  });

  it("builds the key from a CSV row", () => {
    expect(
      expectedFlightKey({ airline_code: "V8", flight_number: "220", dep_time_utc: "2026-11-02T06:15:00Z" }),
    ).toBe("V8-220-2026-11-02");
  });

  it("rejects a row with a broken flight number instead of building a key with NaN", () => {
    expect(() =>
      expectedFlightKey({ airline_code: "AA", flight_number: "12a", dep_time_utc: "2026-11-02T06:15:00Z" }),
    ).toThrow(RangeError);
    expect(() =>
      expectedFlightKey({ airline_code: "AA", flight_number: "", dep_time_utc: "2026-11-02T06:15:00Z" }),
    ).toThrow(RangeError);
  });

  it("rejects a row with an invalid airline code", () => {
    expect(() =>
      expectedFlightKey({ airline_code: "aa", flight_number: "123", dep_time_utc: "2026-11-02T06:15:00Z" }),
    ).toThrow(RangeError);
  });
});
