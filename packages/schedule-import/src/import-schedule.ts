import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parse, type InfoRecord } from "csv-parse";
import {
  SCHEDULE_COLUMNS,
  ScheduleRowSchema,
  type ScheduleRow,
} from "./row-schema.ts";

export interface RowError {
  line: number;
  errors: string[];
}

export interface ImportResult {
  rows: number;
  valid: number;
  invalid: RowError[];
}

export interface ImportOptions {
  onBatch: (rows: ScheduleRow[]) => Promise<void>;
  batchSize?: number;
  signal?: AbortSignal;
}

interface ParsedRecord {
  record: Record<string, string | undefined>;
  info: InfoRecord;
}

function checkHeader(header: string[]): string[] {
  const missing = SCHEDULE_COLUMNS.filter((column) => !header.includes(column));

  if (missing.length > 0)
    throw new Error(`CSV header is missing columns: ${missing.join(", ")}`);

  return header;
}

export async function importSchedule(
  input: Readable,
  options: ImportOptions,
): Promise<ImportResult> {
  const { onBatch, signal, batchSize = 500 } = options;
  const result: ImportResult = { rows: 0, valid: 0, invalid: [] };

  async function* validate(records: AsyncIterable<ParsedRecord>) {
    for await (const { record, info } of records) {
      result.rows++;

      if (info.error) {
        result.invalid.push({ line: info.lines, errors: [info.error.message] });
        continue;
      }

      const parsed = ScheduleRowSchema.safeParse(record);
      if (!parsed.success) {
        const errors = parsed.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        );
        result.invalid.push({ line: info.lines, errors });
        continue;
      }

      result.valid++;

      yield parsed.data;
    }
  }
  async function* toBatches(rows: AsyncIterable<ScheduleRow>) {
    let batch: ScheduleRow[] = [];

    for await (const row of rows) {
      batch.push(row);

      if (batch.length === batchSize) {
        yield batch;
        batch = [];
      }
    }

    if (batch.length > 0) yield batch;
  }
  async function write(batches: AsyncIterable<ScheduleRow[]>) {
    // Awaiting onBatch provides backpressure: upstream generators pause until the batch finishes writing instead of buffering all rows in memory.
    for await (const batch of batches) await onBatch(batch);
  }
  await pipeline(
    input,
    parse({
      columns: checkHeader,
      bom: true,
      info: true,
      relax_column_count: true,
      skip_empty_lines: true,
    }),
    validate,
    toBatches,
    write,
    {
      signal,
    },
  );
  return result;
}
