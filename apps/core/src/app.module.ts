import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ProblemDetailsFilter } from "./problem-details.filter.ts";
import { ShutdownLogger } from "./shutdown-logger.service.ts";
import { FlightsModule } from "./flights/flights.module.ts";
import { HealthController } from "./health.controller.ts";
import { EnvSchema } from "./config/env.schema.ts";

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: EnvSchema }),
    FlightsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    ShutdownLogger,
  ],
})
export class AppModule {}
