// Acceptance tests for the TS-2 project stage — FlightKey in @interline/contracts.
// Copy this file to packages/contracts/src/flight-key.test.ts and do not edit it.
// `pnpm test` runs the runtime half, `pnpm typecheck` checks the type half
// (expectTypeOf and @ts-expect-error lines are checked by tsc, not by Vitest).
import { describe, expect, expectTypeOf, it } from "vitest";
import { formatFlightKey, parseFlightKey, type FlightKey } from "./index.ts";

// A function that accepts only a FlightKey — the place where the brand matters.
const accept = (key: FlightKey): FlightKey => key;

describe("FlightKey brand", () => {
  it("a plain string is not a FlightKey, a FlightKey is still a string", () => {
    // @ts-expect-error — a string literal must not pass for a validated key
    accept("AA-123-2026-11-02");

    const key = formatFlightKey({ airline: "AA", number: 123, date: "2026-11-02" });
    expect(accept(key)).toBe("AA-123-2026-11-02");

    const asText: string = key; // the brand only narrows: string methods still work
    expect(asText.length).toBe(17);
    expectTypeOf(formatFlightKey).returns.toEqualTypeOf<FlightKey>();
  });

  it("the brand is gone after string operations", () => {
    const key = formatFlightKey({ airline: "Q7", number: 7, date: "2026-11-02" });
    // @ts-expect-error — toLowerCase() returns a plain string, not a FlightKey
    accept(key.toLowerCase());
    expect(typeof key).toBe("string"); // at runtime a FlightKey is just a string
  });
});

describe("formatFlightKey", () => {
  it("keeps the AIRLINE-NUMBER-YYYY-MM-DD format", () => {
    expect(formatFlightKey({ airline: "AA", number: 123, date: "2026-10-13" })).toBe("AA-123-2026-10-13");
    expect(formatFlightKey({ airline: "Q7", number: 1, date: "2026-11-02" })).toBe("Q7-1-2026-11-02");
    expect(formatFlightKey({ airline: "X9", number: 9999, date: "2028-02-29" })).toBe("X9-9999-2028-02-29");
  });

  it("throws RangeError on an invalid airline code", () => {
    for (const airline of ["aa", "A", "AAA", "A-", ""]) {
      expect(() => formatFlightKey({ airline, number: 123, date: "2026-11-02" }), airline).toThrow(RangeError);
    }
  });

  it("throws RangeError on a flight number outside 1..9999 or not an integer", () => {
    for (const number of [0, -1, 10000, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => formatFlightKey({ airline: "AA", number, date: "2026-11-02" }), String(number)).toThrow(RangeError);
    }
  });

  it("throws RangeError on a date that is not a real YYYY-MM-DD calendar date", () => {
    for (const date of ["2026-02-30", "2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "2026-11-2", "2026/11/02", "2026-11-02T10:00:00Z"]) {
      expect(() => formatFlightKey({ airline: "AA", number: 123, date }), date).toThrow(RangeError);
    }
  });
});

describe("parseFlightKey", () => {
  it("returns the key and its parts for a valid key", () => {
    const result = parseFlightKey("Q7-123-2026-11-02");
    expect(result).toEqual({ ok: true, key: "Q7-123-2026-11-02", airline: "Q7", number: 123, date: "2026-11-02" });
  });

  it("round-trips with formatFlightKey", () => {
    const parts = { airline: "K5", number: 42, date: "2028-02-29" };
    const result = parseFlightKey(formatFlightKey(parts));
    expect(result.ok && { airline: result.airline, number: result.number, date: result.date }).toEqual(parts);
  });

  it("reports which part is wrong", () => {
    const cases: [string, string][] = [
      ["", "format"],
      ["AA123-2026-11-02", "format"], // four pieces instead of five
      ["AA-123-2026-11-02-1", "format"], // six pieces
      ["AA--123-2026-11-02", "format"],
      ["aa-123-2026-11-02", "airline"],
      [" AA-123-2026-11-02", "airline"],
      ["AA-0123-2026-11-02", "number"], // leading zero: the key would not round-trip
      ["AA-0-2026-11-02", "number"],
      ["AA-10000-2026-11-02", "number"],
      ["AA-12a-2026-11-02", "number"],
      ["AA-1e3-2026-11-02", "number"], // Number("1e3") is 1000 — in range, but not a flight number
      ["AA- 12-2026-11-02", "number"], // Number(" 12") is 12 — whitespace is silently trimmed
      ["AA-123-2026-02-30", "date"], // Date would silently roll it over to March 2
      ["AA-123-2026-11-2", "date"],
      ["AA-123-26-11-02", "date"],
    ];
    for (const [input, error] of cases) {
      expect(parseFlightKey(input), JSON.stringify(input)).toEqual({ ok: false, error });
    }
  });

  it("checks the parts in order: airline, then number, then date", () => {
    expect(parseFlightKey("aa-0-2026-02-30")).toEqual({ ok: false, error: "airline" });
    expect(parseFlightKey("AA-0-2026-02-30")).toEqual({ ok: false, error: "number" });
  });

  it("narrows the result by ok", () => {
    const result = parseFlightKey("AA-123-2026-11-02");
    // @ts-expect-error — the key exists only on the success variant: check ok first
    expect(result.key).toBeDefined();
    if (result.ok) {
      expectTypeOf(result.key).toEqualTypeOf<FlightKey>();
      expectTypeOf(result.number).toEqualTypeOf<number>();
      expect(accept(result.key)).toBe("AA-123-2026-11-02");
    } else {
      expectTypeOf(result.error).toEqualTypeOf<"format" | "airline" | "number" | "date">();
    }
  });
});
