import { Readable } from "node:stream";
import { importSchedule } from "./import-schedule.ts";
import { SCHEDULE_COLUMNS } from "./row-schema.ts";
import { expectedFlightKey } from "./flight-key.ts";

const rows = Number(process.argv[2] ?? 10_000);

function* csv(count: number): Generator<string> {
  const start = Date.UTC(2026, 10, 2);

  yield `${SCHEDULE_COLUMNS.join(",")}\n`;

  for (let i = 0; i < count; i += 1) {
    const dep_time = new Date(start + i * 60_000)
      .toISOString()
      .replace(".000", "");
    const arr_time = new Date(start + i * 60_000 + 90 * 60_000)
      .toISOString()
      .replace(".000", "");
    const number = (i % 9999) + 1;

    yield `${expectedFlightKey({
      airline_code: "Q7",
      dep_time_utc: dep_time,
      flight_number: number.toString(),
    })},Q7,${number},LIS,MAD,${dep_time},${arr_time}\n`;
  }
}

const result = await importSchedule(Readable.from(csv(rows)), {
  onBatch: async () => {},
});
const peakRssMb = process.resourceUsage().maxRSS / 1024;

console.log(
  `rows=${rows} valid=${result.valid} invalid=${result.invalid.length} peakRssMb=${peakRssMb.toFixed(1)}`,
);
