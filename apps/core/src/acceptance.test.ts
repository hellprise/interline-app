// Acceptance tests for the Nest lesson 1 project stage — apps/core.
// Copy this file to apps/core/src/acceptance.test.ts and do not edit it.
// `pnpm test` runs it. The HTTP part uses supertest, which listens on a random local port.
import "reflect-metadata";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module.ts";
import { FlightsController } from "./flights/flights.controller.ts";
import { FlightsService } from "./flights/flights.service.ts";

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

  it.each([
    ["aa-1-2026-11-02", "airline"],
    ["AA-0123-2026-11-02", "number"],
    ["AA-1-2026-02-30", "date"],
    ["garbage", "format"],
  ])("GET /flights/%s returns 400 with exactly { error: '%s' }", async (key, error) => {
    const res = await request(app.getHttpServer()).get(`/flights/${key}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
  });

  it("an unknown route is 404", async () => {
    const res = await request(app.getHttpServer()).get("/airports");
    expect(res.status).toBe(404);
  });
});
