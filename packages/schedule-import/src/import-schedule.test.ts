// Acceptance tests for the Node lesson 2 project stage — a streaming schedule import.
// Copy this file to packages/schedule-import/src/import-schedule.test.ts and do not edit it.
import { Readable } from "node:stream";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { FlightKey } from "@interline/contracts";
import { importSchedule, type ScheduleRow } from "./index.ts";

const HEADER = "flight_key,airline_code,flight_number,dep_airport,arr_airport,dep_time_utc,arr_time_utc";
const START = Date.UTC(2026, 10, 2);

// A valid row number i: Q7, flight 1..9999, one departure a minute, 90 minutes in the air.
function row(i: number): string {
  const dep = new Date(START + i * 60_000).toISOString().replace(".000", "");
  const arr = new Date(START + i * 60_000 + 90 * 60_000).toISOString().replace(".000", "");
  const number = (i % 9999) + 1;
  return `Q7-${number}-${dep.slice(0, 10)},Q7,${number},LIS,MAD,${dep},${arr}`;
}

function file(lines: string[], eol = "\n"): Readable {
  return Readable.from([lines.join(eol) + eol]);
}

// Collects every batch, so a test can look at sizes and contents.
function collector() {
  const batches: ScheduleRow[][] = [];
  return {
    batches,
    onBatch: (rows: ScheduleRow[]) => {
      batches.push(rows);
      return Promise.resolve();
    },
  };
}

// Imports the lines and returns the size of every batch.
async function sizes(lines: string[], batchSize: number): Promise<number[]> {
  const sink = collector();
  await importSchedule(file(lines), { onBatch: sink.onBatch, batchSize });
  return sink.batches.map((b) => b.length);
}

// A source that makes one line per read() and counts how many lines it has handed out.
function countingSource(total: number) {
  let made = 0;
  const stream = new Readable({
    read() {
      if (made === 0) this.push(HEADER + "\n");
      if (made === total) {
        this.push(null);
        return;
      }
      this.push(row(made) + "\n");
      made += 1;
    },
  });
  return { stream, made: () => made };
}

describe("importSchedule — the happy path", () => {
  it("imports a clean file in batches of 500, the last one partial", async () => {
    const lines = [HEADER, ...Array.from({ length: 1234 }, (_, i) => row(i))];
    const sink = collector();

    const result = await importSchedule(file(lines), { onBatch: sink.onBatch });

    expect(result).toEqual({ rows: 1234, valid: 1234, invalid: [] });
    expect(sink.batches.map((b) => b.length)).toEqual([500, 500, 234]);
  });

  it("honours batchSize: batches of valid rows, no empty batch at the end", async () => {
    expect(await sizes([HEADER, row(0), row(1), row(2)], 2)).toEqual([2, 1]);
    expect(await sizes([HEADER, row(0), row(1), row(2), row(3)], 2)).toEqual([2, 2]);
    const bad = row(9).replace(",LIS,", ",LISBON,");
    expect(await sizes([HEADER, bad, row(0), row(1), row(2)], 2)).toEqual([2, 1]);
  });

  it("gives typed rows: a FlightKey and a numeric flight number", async () => {
    const sink = collector();
    await importSchedule(file([HEADER, row(122)]), { onBatch: sink.onBatch });

    const [first] = sink.batches[0] ?? [];
    expect(first).toEqual({
      flight_key: "Q7-123-2026-11-02",
      airline_code: "Q7",
      flight_number: 123,
      dep_airport: "LIS",
      arr_airport: "MAD",
      dep_time_utc: "2026-11-02T02:02:00Z",
      arr_time_utc: "2026-11-02T03:32:00Z",
    });
    expectTypeOf<ScheduleRow["flight_key"]>().toEqualTypeOf<FlightKey>();
    expectTypeOf<ScheduleRow["flight_number"]>().toEqualTypeOf<number>();
  });

  it("reads a file saved by Excel: a BOM and CRLF line endings", async () => {
    const sink = collector();
    const result = await importSchedule(Readable.from(["﻿" + [HEADER, row(0), row(1)].join("\r\n") + "\r\n"]), {
      onBatch: sink.onBatch,
    });

    expect(result).toEqual({ rows: 2, valid: 2, invalid: [] });
    expect(sink.batches[0]?.[1]?.arr_time_utc).toBe("2026-11-02T01:31:00Z");
  });

  it("reads quoted fields as plain values", async () => {
    const quoted = row(0).split(",").map((field) => `"${field}"`).join(",");
    const result = await importSchedule(file([HEADER, quoted]), { onBatch: async () => {} });
    expect(result).toEqual({ rows: 1, valid: 1, invalid: [] });
  });

  it("keeps a line break inside quotes in one record", async () => {
    const fields = row(1).split(",");
    fields[0] = `"${fields[0]}\nX"`; // a flight_key with a line break inside quotes
    const result = await importSchedule(file([HEADER, row(0), fields.join(","), row(2)]), {
      onBatch: async () => {},
    });

    expect(result.valid).toBe(2);
    expect(result.invalid.map((e) => e.line)).toEqual([4]); // a record over lines 3–4 is reported by its last line
  });
});

describe("importSchedule — bad rows go to the report, the import goes on", () => {
  it("reports bad rows with their line numbers in the file", async () => {
    const badNumber = row(1).replace(",Q7,2,", ",Q7,2a,");
    const badKey = row(3).replace("Q7-4-", "Q7-44-");
    const twoBad = row(5).replace(",Q7,6,", ",Q7,6a,").replace(",LIS,", ",LISBON,");
    const sink = collector();

    const result = await importSchedule(file([HEADER, row(0), badNumber, row(2), badKey, row(4), twoBad]), {
      onBatch: sink.onBatch,
    });

    expect(result.rows).toBe(6);
    expect(result.valid).toBe(3);
    expect(result.invalid).toEqual([
      { line: 3, errors: ["flight_number: expected a number from 1 to 9999"] },
      { line: 5, errors: ["flight_key: expected Q7-4-2026-11-02, got Q7-44-2026-11-02"] },
      {
        line: 7,
        errors: ["flight_number: expected a number from 1 to 9999", "dep_airport: expected a 3-letter IATA code"],
      },
    ]);
    expect(sink.batches.flat().map((r) => r.flight_number)).toEqual([1, 3, 5]);
  });

  it("a broken airline code is a reported row, not a crash of the whole import", async () => {
    const result = await importSchedule(file([HEADER, row(0).replaceAll("Q7", "q7"), row(1)]), {
      onBatch: async () => {},
    });

    expect(result.valid).toBe(1);
    expect(result.invalid).toEqual([{ line: 2, errors: ["airline_code: expected 2 characters A-Z or 0-9"] }]);
  });

  it("an arrival that is not after the departure is reported", async () => {
    const [key, airline, number, from, to, dep] = row(0).split(",");
    const result = await importSchedule(file([HEADER, [key, airline, number, from, to, dep, dep].join(",")]), {
      onBatch: async () => {},
    });
    expect(result.invalid).toEqual([{ line: 2, errors: ["arr_time_utc: must be later than dep_time_utc"] }]);
  });

  it("a row with a missing column is reported, the first data row too", async () => {
    const short = row(1).split(",").slice(0, 3).join(",");
    const result = await importSchedule(file([HEADER, row(0), short, row(2)]), { onBatch: async () => {} });

    expect(result).toEqual({
      rows: 3,
      valid: 2,
      invalid: [{ line: 3, errors: ["Invalid Record Length: columns length is 7, got 3 on line 3"] }],
    });

    const first = await importSchedule(file([HEADER, short, row(2)]), { onBatch: async () => {} });
    expect(first).toMatchObject({ rows: 2, valid: 1, invalid: [{ line: 2 }] });
  });

  it("a row with an extra field is reported, not imported with the field dropped", async () => {
    const sink = collector();
    const result = await importSchedule(file([HEADER, row(0), `${row(1)},A320`, row(2)]), { onBatch: sink.onBatch });

    expect(result).toEqual({
      rows: 3,
      valid: 2,
      invalid: [{ line: 3, errors: ["Invalid Record Length: columns length is 7, got 8 on line 3"] }],
    });
    expect(sink.batches.flat().map((r) => r.flight_number)).toEqual([1, 3]);
  });

  it("skips empty lines but keeps the line numbers of the file", async () => {
    const bad = row(1).replace(",LIS,", ",LISBON,");
    const result = await importSchedule(Readable.from([[HEADER, row(0), "", bad].join("\n") + "\n\n"]), {
      onBatch: async () => {},
    });

    expect(result.rows).toBe(2);
    expect(result.invalid).toEqual([{ line: 4, errors: ["dep_airport: expected a 3-letter IATA code"] }]);
  });
});

describe("importSchedule — the file as a whole", () => {
  it("rejects a header without required columns before any batch, and names them all", async () => {
    const onBatch = vi.fn(async () => {});
    const header = HEADER.replace("dep_airport,", "").replace(",arr_time_utc", "");
    const data = row(0)
      .split(",")
      .filter((_, i) => i !== 3 && i !== 6)
      .join(",");

    await expect(importSchedule(file([header, data]), { onBatch })).rejects.toThrow(
      "CSV header is missing columns: dep_airport, arr_time_utc",
    );
    // A file with a header and no rows is checked too.
    await expect(importSchedule(file([HEADER.replace("dep_airport,", "")]), { onBatch })).rejects.toThrow(
      "CSV header is missing columns: dep_airport",
    );
    expect(onBatch).not.toHaveBeenCalled();
  });

  it("matches header names exactly, and allows an extra column and another order", async () => {
    const otherCase = file([HEADER.replace("dep_airport", "Dep_Airport"), row(0)]);
    await expect(importSchedule(otherCase, { onBatch: async () => {} })).rejects.toThrow(
      "CSV header is missing columns: dep_airport",
    );

    const extra = await importSchedule(file([`${HEADER},aircraft`, `${row(0)},A320`]), { onBatch: async () => {} });
    expect(extra).toEqual({ rows: 1, valid: 1, invalid: [] });

    const swap = (fields: string[]) => [fields[1], fields[0], ...fields.slice(2)].join(",");
    const reordered = await importSchedule(file([swap(HEADER.split(",")), swap(row(0).split(","))]), {
      onBatch: async () => {},
    });
    expect(reordered).toEqual({ rows: 1, valid: 1, invalid: [] });
  });

  it("an empty file with only a header imports nothing", async () => {
    const onBatch = vi.fn(async () => {});
    await expect(importSchedule(file([HEADER]), { onBatch })).resolves.toEqual({ rows: 0, valid: 0, invalid: [] });
    expect(onBatch).not.toHaveBeenCalled();
  });
});

describe("importSchedule — streaming", () => {
  it("does not read far ahead while onBatch is busy, and stops on abort", async () => {
    const source = countingSource(100_000);
    const controller = new AbortController();
    let release = () => {};
    const busy = new Promise<void>((resolve) => { release = resolve; });
    const onBatch = vi.fn(() => busy);

    const promise = importSchedule(source.stream, { onBatch, signal: controller.signal });
    await vi.waitFor(() => expect(onBatch).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(source.made()).toBeLessThan(5_000);

    controller.abort();
    release();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(source.stream.destroyed).toBe(true);
  });

  it("stops on a signal aborted before the start, and on abort while the file sends nothing", { timeout: 2000 }, async () => {
    await expect(
      importSchedule(file([HEADER]), { onBatch: async () => {}, signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ name: "AbortError" });

    const controller = new AbortController();
    const stalled = new Readable({ read() {} }); // an upload that stopped sending
    stalled.push(`${HEADER}\n${row(0)}\n`);
    const promise = importSchedule(stalled, { onBatch: async () => {}, signal: controller.signal });
    setTimeout(() => controller.abort(), 20);

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(stalled.destroyed).toBe(true);
  });

  it("an error in onBatch rejects the import with that error and closes the source", async () => {
    const source = countingSource(100_000);
    const onBatch = vi.fn(() => Promise.reject(new Error("database is down")));

    await expect(importSchedule(source.stream, { onBatch })).rejects.toThrow("database is down");
    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(source.stream.destroyed).toBe(true);
    expect(source.made()).toBeLessThan(5_000);
  });

  it("waits for the last, partial batch, and its error rejects the import too", async () => {
    let written = 0;
    await importSchedule(file([HEADER, row(0)]), {
      onBatch: async (rows) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        written += rows.length;
      },
    });
    expect(written).toBe(1);

    const failing = importSchedule(file([HEADER, row(0)]), {
      onBatch: () => Promise.reject(new Error("database is down")),
    });
    await expect(failing).rejects.toThrow("database is down");
  });
});
