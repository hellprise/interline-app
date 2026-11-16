# @interline/schedule-import

Streaming import of `flights.csv`: CSV -> row validation (Zod) -> batches of 500 -> `onBatch`.

## Memory

Measured with `node src/measure-rss.ts <rows>` on Node 26.11.1:

| Rows      | Peak RSS |
| --------- | -------- |
| 10,000    | 114.8 MB |
| 100,000   | 150.5 MB |
| 1,000,000 | 168.5 MB |

100x more rows cost only ~1.5x more memory: the file is never held in memory as a whole.
