// Acceptance tests for the Prisma lesson 1 project stage (Postgres behind apps/core) — apps/core.
// Copy this file to apps/core/src/db.acceptance.test.ts and do not edit it.
// It needs a running Postgres and DATABASE_URL pointing at it: apps/core/.env locally, the job env in CI.
// The file creates its own database on that server, applies prisma/migrations with `prisma migrate deploy`,
// starts the app on it and drops it at the end. Your dev database is never touched.
// The app modules are imported inside the hooks, so the schema tests can pass before the Nest part exists.
import "reflect-metadata";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Client, escapeIdentifier, type QueryResultRow } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const coreDir = join(import.meta.dirname, "..");
const prismaCli = join(coreDir, "node_modules", ".bin", "prisma");
const dbName = `core_test_${process.pid}_${Date.now()}`;

let testUrl = "";
let admin: Client | undefined; // on the server's "postgres" database: creates and drops the test database
let db: Client | undefined; // on the test database: seeds rows and checks constraints with plain SQL

// The same server and credentials as DATABASE_URL, another database.
function withDatabase(url: string, name: string): string {
  const next = new URL(url);
  next.pathname = `/${name}`;
  return next.toString();
}

// Runs the Prisma CLI of apps/core against the test database.
function prisma(args: string[]) {
  return spawnSync(prismaCli, args, {
    cwd: coreDir,
    env: { ...process.env, DATABASE_URL: testUrl },
    encoding: "utf8",
  });
}

async function sql<Row extends QueryResultRow>(text: string, values: unknown[] = []): Promise<Row[]> {
  if (db === undefined) throw new Error("the test database is not ready: see the error of beforeAll");
  const result = await db.query<Row>(text, values);
  return result.rows;
}

interface FlightRow {
  key: string;
  airline?: string;
  from?: string;
  to?: string;
  departure?: string;
  arrival?: string;
}

function insertFlight(row: FlightRow): Promise<unknown[]> {
  return sql(
    `INSERT INTO flights (flight_key, airline_code, flight_number, dep_airport, arr_airport, dep_time_utc, arr_time_utc)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      row.key,
      row.airline ?? "Q7",
      Number(row.key.split("-")[1]),
      row.from ?? "LIS",
      row.to ?? "MAD",
      row.departure ?? "2026-11-02T10:00:00Z",
      row.arrival ?? "2026-11-02T11:00:00Z",
    ],
  );
}

// A client is kept only once it has connected, so afterAll never talks to a dead one.
async function connect(url: string): Promise<Client> {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
  } catch (error) {
    const where = new URL(url).host;
    throw new Error(`cannot connect to Postgres at ${where}: is it running? (docker compose up -d --wait)`, {
      cause: error,
    });
  }
  return client;
}

beforeAll(async () => {
  const baseUrl = process.env["DATABASE_URL"];
  if (!baseUrl) {
    throw new Error("DATABASE_URL is not set: start Postgres (docker compose up -d --wait) and create apps/core/.env");
  }
  testUrl = withDatabase(baseUrl, dbName);
  admin = await connect(withDatabase(baseUrl, "postgres"));
  await admin.query(`CREATE DATABASE ${escapeIdentifier(dbName)}`);

  const deploy = prisma(["migrate", "deploy"]);
  if (deploy.status !== 0) {
    throw new Error(`prisma migrate deploy failed:\n${deploy.stdout}\n${deploy.stderr}`);
  }

  db = await connect(testUrl);
  await sql("INSERT INTO airlines (code, name) VALUES ('Q7', 'Interline Air')");
  await sql("INSERT INTO airports (iata, name, country) VALUES ('LIS', 'Lisbon', 'PT'), ('MAD', 'Madrid', 'ES')");
  await insertFlight({ key: "Q7-123-2026-11-02", departure: "2026-11-02T08:00:00Z", arrival: "2026-11-02T09:30:00Z" });
}, 60_000);

afterAll(async () => {
  await db?.end();
  if (admin !== undefined) {
    await admin.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(dbName)} WITH (FORCE)`);
    await admin.end();
  }
});

describe("schema and migrations", () => {
  it("migrate deploy applied every folder of prisma/migrations, in order", async () => {
    const folders = readdirSync(join(coreDir, "prisma", "migrations"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const applied = await sql<{ migration_name: string }>(
      `SELECT migration_name FROM _prisma_migrations
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
       ORDER BY migration_name`,
    );
    expect(folders.length).toBeGreaterThan(0);
    expect(applied.map((row) => row.migration_name)).toEqual(folders);
  });

  it("the departure and arrival times are timestamptz: points in time, not wall-clock readings", async () => {
    const columns = await sql(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'flights' AND column_name IN ('dep_time_utc', 'arr_time_utc')
       ORDER BY column_name`,
    );
    expect(columns).toEqual([
      { column_name: "arr_time_utc", data_type: "timestamp with time zone" },
      { column_name: "dep_time_utc", data_type: "timestamp with time zone" },
    ]);
  });

  it("flight_key is unique", async () => {
    await expect(insertFlight({ key: "Q7-123-2026-11-02" })).rejects.toMatchObject({ code: "23505" });
  });

  it("a flight must arrive after it departs: CHECK flights_arrival_after_departure", async () => {
    const rejected = { code: "23514", constraint: "flights_arrival_after_departure" };
    const sameMinute = { departure: "2026-11-02T10:00:00Z", arrival: "2026-11-02T10:00:00Z" };
    const backwards = { departure: "2026-11-02T11:00:00Z", arrival: "2026-11-02T10:00:00Z" };
    await expect(insertFlight({ key: "Q7-900-2026-11-02", ...sameMinute })).rejects.toMatchObject(rejected);
    await expect(insertFlight({ key: "Q7-901-2026-11-02", ...backwards })).rejects.toMatchObject(rejected);
    // One minute later is fine: the constraint rejects bad rows, not every row.
    await expect(
      insertFlight({ key: "Q7-902-2026-11-02", departure: "2026-11-02T10:00:00Z", arrival: "2026-11-02T10:01:00Z" }),
    ).resolves.toEqual([]);
  });

  it("a flight must point at an existing airline and existing airports (foreign keys)", async () => {
    const missing = { code: "23503" };
    await expect(insertFlight({ key: "ZZ-1-2026-11-02", airline: "ZZ" })).rejects.toMatchObject(missing);
    await expect(insertFlight({ key: "Q7-903-2026-11-02", from: "XXX" })).rejects.toMatchObject(missing);
    await expect(insertFlight({ key: "Q7-904-2026-11-02", to: "XXX" })).rejects.toMatchObject(missing);
  });

  it("schema.prisma and the migrations agree: migrate diff finds nothing to change", () => {
    const diff = prisma(["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"]);
    expect(diff.status, `${diff.stdout}\n${diff.stderr}`).toBe(0);
  });
});

describe("the app on the test database", () => {
  let app: INestApplication | undefined;
  let closed = false;

  // Connections to the test database other than `db` itself: the app's pool.
  async function appConnections(): Promise<number> {
    const [row] = await sql<{ count: number }>(
      `SELECT count(*)::int AS count FROM pg_stat_activity
       WHERE datname = current_database() AND backend_type = 'client backend' AND pid <> pg_backend_pid()`,
    );
    return row?.count ?? 0;
  }

  function server() {
    if (app === undefined) throw new Error("the app did not start: see the error of beforeAll");
    return app.getHttpServer() as Parameters<typeof request>[0];
  }

  beforeAll(async () => {
    // ConfigModule reads the environment when app.module.ts is evaluated,
    // so the module is imported only after DATABASE_URL points at the test database.
    vi.stubEnv("DATABASE_URL", testUrl);
    const { AppModule } = await import("./app.module.ts");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }, 30_000);

  afterAll(async () => {
    if (!closed) await app?.close();
    vi.unstubAllEnvs();
  });

  it("AppConfigService gives the database URL and the port as typed fields", async () => {
    const { AppConfigService } = await import("./config/app-config.service.ts");
    const config = app?.get(AppConfigService);
    expect(config?.databaseUrl).toBe(testUrl);
    expect(config?.port).toBeTypeOf("number");
  });

  it("GET /flights/:key reads the flight, its airline and its airports from the database", async () => {
    const res = await request(server()).get("/flights/Q7-123-2026-11-02");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(res.body).toEqual({
      key: "Q7-123-2026-11-02",
      airline: { code: "Q7", name: "Interline Air" },
      number: 123,
      from: { iata: "LIS", name: "Lisbon", country: "PT" },
      to: { iata: "MAD", name: "Madrid", country: "ES" },
      departure: "2026-11-02T08:00:00.000Z",
      arrival: "2026-11-02T09:30:00.000Z",
    });
  });

  it("a valid key with no flight behind it is a 404 problem that names the key", async () => {
    const res = await request(server()).get("/flights/Q7-999-2026-11-02");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    // Matchers are typed `any`; parking one in an `unknown` keeps typed lint (no-unsafe-assignment) quiet.
    const detail: unknown = expect.stringContaining("Q7-999-2026-11-02");
    expect(res.body).toEqual({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail,
      instance: "/flights/Q7-999-2026-11-02",
    });
  });

  it("closing the app closes its database connections", async () => {
    await request(server()).get("/flights/Q7-123-2026-11-02"); // the pool has a connection now
    expect(await appConnections()).toBeGreaterThan(0);
    await app?.close();
    closed = true;
    await expect.poll(appConnections, { timeout: 3_000 }).toBe(0);
  });
});
