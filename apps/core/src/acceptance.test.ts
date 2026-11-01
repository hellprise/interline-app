// Acceptance tests for the Nest lesson 2 project stage (errors as RFC 9457 Problem Details) — apps/core.
// Copy this file over apps/core/src/acceptance.test.ts and do not edit it.
// `pnpm test` runs it; `pnpm typecheck` checks the expectTypeOf lines (tsc checks them, not Vitest).
// The HTTP part uses supertest, which listens on a random local port.
import "reflect-metadata";
import { inspect } from "node:util";
import type { ParseFlightKeyResult } from "@interline/contracts";
import { Controller, Get, HttpException, Logger, type PipeTransform } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";
import { AppModule } from "./app.module.ts";
import { FlightsController } from "./flights/flights.controller.ts";
import { FlightsService } from "./flights/flights.service.ts";
import { InvalidFlightKeyError } from "./flights/invalid-flight-key.error.ts";
import { ParseFlightKeyPipe } from "./flights/parse-flight-key.pipe.ts";

// Calls fn and returns what it threw; fails the test if nothing was thrown.
function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw, but it returned");
}

// A route that fails the way a real bug does: a plain Error whose message must not reach the client.
@Controller("boom")
class BoomController {
  @Get()
  explode(): never {
    throw new Error("db password is hunter2");
  }
}

describe("dependency injection metadata (no HTTP)", () => {
  it("FlightsController's constructor metadata references FlightsService", () => {
    // `import type { FlightsService }` would leave Function here and Nest could not inject it.
    const paramTypes: unknown = Reflect.getMetadata("design:paramtypes", FlightsController);
    expect(paramTypes).toEqual([FlightsService]);
  });

  it("AppModule compiles and FlightsService is registered", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(moduleRef.get(FlightsService)).toBeInstanceOf(FlightsService);
    await moduleRef.close();
  });
});

describe("ParseFlightKeyPipe and InvalidFlightKeyError (no HTTP)", () => {
  // Called through the PipeTransform interface, the way Nest calls it: transform(value, metadata).
  const pipe: PipeTransform<string, unknown> = new ParseFlightKeyPipe();

  it("returns the parsed parts of a valid key, without the ok tag", () => {
    const parsed = pipe.transform("Q7-123-2026-11-02", { type: "param", data: "key" });
    expect(parsed).toEqual({ key: "Q7-123-2026-11-02", airline: "Q7", number: 123, date: "2026-11-02" });
  });

  it("types come from @interline/contracts: FlightKey brand kept, error kinds reused (checked by tsc)", () => {
    expectTypeOf<ReturnType<ParseFlightKeyPipe["transform"]>>().toEqualTypeOf<
      Omit<Extract<ParseFlightKeyResult, { ok: true }>, "ok">
    >();
    expectTypeOf<InvalidFlightKeyError["kind"]>().toEqualTypeOf<Extract<ParseFlightKeyResult, { ok: false }>["error"]>();
  });

  it("throws a plain domain error for a bad key: an Error that knows nothing about HTTP", () => {
    const error = thrownBy(() => pipe.transform("garbage", { type: "param", data: "key" }));
    expect(error).toBeInstanceOf(InvalidFlightKeyError);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(HttpException);
    expect(error).toMatchObject({ name: "InvalidFlightKeyError", kind: "format", input: "garbage" });
  });
});

describe("HTTP contract", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /health returns 200 { status: 'ok' }", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /flights/:key returns the parsed key as JSON", async () => {
    const res = await request(app.getHttpServer()).get("/flights/Q7-123-2026-11-02");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(res.body).toEqual({ key: "Q7-123-2026-11-02", airline: "Q7", number: 123, date: "2026-11-02" });
  });

  it("decodes the path parameter before parsing it", async () => {
    const res = await request(app.getHttpServer()).get("/flights/Q7%2D123%2D2026%2D11%2D02");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ key: "Q7-123-2026-11-02", airline: "Q7", number: 123, date: "2026-11-02" });
  });

  it("the raw path parameter goes through ParseFlightKeyPipe", async () => {
    const transform = vi.spyOn(ParseFlightKeyPipe.prototype, "transform");
    const res = await request(app.getHttpServer()).get("/flights/Q7-123-2026-11-02");
    expect(res.status).toBe(200);
    expect(transform).toHaveBeenCalledWith("Q7-123-2026-11-02", expect.objectContaining({ type: "param", data: "key" }));
  });

  it.each([
    ["aa-1-2026-11-02", "airline"],
    ["AA-0123-2026-11-02", "number"],
    ["AA-1-2026-02-30", "date"],
    ["garbage", "format"],
  ])("GET /flights/%s returns a 400 invalid-flight-key problem with error '%s'", async (key, error) => {
    const res = await request(app.getHttpServer()).get(`/flights/${key}`);
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    // Matchers are typed `any`; parking one in an `unknown` keeps typed lint (no-unsafe-assignment) quiet.
    const detail: unknown = expect.stringMatching(new RegExp(error, "i")); // a sentence that names the broken part
    expect(res.body).toEqual({
      type: "/problems/invalid-flight-key",
      title: "Invalid flight key",
      status: 400,
      detail,
      instance: `/flights/${key}`,
      error,
    });
  });

  it("an unknown route is a 404 problem, not Nest's default body", async () => {
    const res = await request(app.getHttpServer()).get("/airports");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(res.body).not.toHaveProperty("statusCode");
    const detail: unknown = expect.any(String); // the message Nest put into its NotFoundException
    expect(res.body).toEqual({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail,
      instance: "/airports",
    });
  });

  it("a path parameter that is not valid percent-encoding is a 400 problem", async () => {
    const res = await request(app.getHttpServer()).get("/flights/%ZZ");
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    const detail: unknown = expect.any(String); // Express's "Failed to decode param ..."
    expect(res.body).toEqual({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail,
      instance: "/flights/%ZZ",
    });
  });
});

describe("unexpected errors", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [BoomController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("an unexpected error is a 500 problem that does not leak its message", async () => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined); // keep the output quiet
    vi.spyOn(Logger, "error").mockImplementation(() => undefined);
    const res = await request(app.getHttpServer()).get("/boom");
    expect(res.status).toBe(500);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(res.text).not.toContain("hunter2");
    expect(res.body).toEqual({
      type: "about:blank",
      title: "Internal Server Error",
      status: 500,
      instance: "/boom",
    });
  });

  it("the unexpected error is logged with its stack through Nest's Logger", async () => {
    // Either style counts: new Logger(...).error(...) or the static Logger.error(...).
    const onInstance = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const onStatic = vi.spyOn(Logger, "error").mockImplementation(() => undefined);
    await request(app.getHttpServer()).get("/boom");
    const logged = [...onInstance.mock.calls, ...onStatic.mock.calls]
      .flat()
      .map((arg) => (typeof arg === "string" ? arg : inspect(arg)))
      .join("\n");
    expect(logged).toContain("db password is hunter2");
    expect(logged).toContain("acceptance.test.ts"); // a stack frame of BoomController.explode, not only the message
  });
});
