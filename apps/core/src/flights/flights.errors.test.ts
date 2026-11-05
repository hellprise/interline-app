import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { AppModule } from "../app.module.ts";
import { FlightsService } from "./flights.service.ts";
import { Logger } from "@nestjs/common";

let app: NestExpressApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(FlightsService)
    .useValue({
      findByKey: () => {
        throw new Error("db is down");
      },
    })
    .compile();

  app = moduleRef.createNestApplication<NestExpressApplication>();
  await app.init();
});

afterAll(async () => await app.close());

it("a failure in FlightService is a 500 problem without its message", async () => {
  vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  const res = await request(app.getHttpServer()).get(
    "/flights/Q7-123-2026-11-05",
  );
  expect(res.status).toBe(500);
  expect(res.text).not.toContain("db is down");
});

afterEach(() => vi.restoreAllMocks());
