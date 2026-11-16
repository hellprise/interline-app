import { z } from "zod";
import { expectedFlightKey } from "./flight-key.ts";

export const SCHEDULE_COLUMNS = [
  "flight_key",
  "airline_code",
  "flight_number",
  "dep_airport",
  "arr_airport",
  "dep_time_utc",
  "arr_time_utc",
] as const;

const airport = z.string().regex(/^[A-Z]{3}$/, "expected a 3-letter IATA code");

export const ScheduleRowSchema = z
  .object({
    flight_key: z.string(),
    airline_code: z
      .string()
      .regex(/^[A-Z0-9]{2}$/, "expected 2 characters A-Z or 0-9"),
    flight_number: z
      .string()
      .regex(/^[1-9]\d{0,3}$/, "expected a number from 1 to 9999"),
    dep_airport: airport,
    arr_airport: airport,
    dep_time_utc: z.iso.datetime(),
    arr_time_utc: z.iso.datetime(),
    // z.iso.datetime accepts only UTC time including the zone and seconds
    // "2026-11-02T08:00:00Z"       -> OK
    // "2026-11-02T08:00:00+02:00"  -> Invalid ISO datetime
    // "2026-11-02T08:00Z"          -> Invalid ISO datetime
    // "2026-13-02T08:00:00Z"       -> Invalid ISO datetime
  })
  .transform((row, ctx) => {
    // arrival after departure
    if (Date.parse(row.arr_time_utc) <= Date.parse(row.dep_time_utc)) {
      ctx.addIssue({
        code: "custom",
        path: ["arr_time_utc"],
        message: "must be later than dep_time_utc",
      });
      return z.NEVER;
    }

    // row flight key doesn't match with expected flight key.
    // Run this check in transform rather than superRefine: transform only runs after all fields pass format validation, whereas superRefine would also run on invalid fields and cause expectedFlightKey to throw a RangeError for the entire import.
    const key = expectedFlightKey(row);
    if (row.flight_key !== key) {
      ctx.addIssue({
        code: "custom",
        path: ["flight_key"],
        message: `expected ${key}, got ${row.flight_key}`,
      });
      return z.NEVER;
    }

    return {
      ...row,
      flight_key: key,
      flight_number: Number(row.flight_number),
    };
  });

export type ScheduleRow = z.output<typeof ScheduleRowSchema>;
