import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { FlightsModule } from "./flights/flights.module.ts";
import { HealthController } from "./health.controller.ts";
import { ProblemDetailsFilter } from "./problem-details.filter.ts";

@Module({
  controllers: [HealthController],
  imports: [FlightsModule],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
