import { Module } from "@nestjs/common";
import { FlightsModule } from "./flights/flights.module.ts";
import { HealthController } from "./health.controller.ts";

@Module({
  controllers: [HealthController],
  imports: [FlightsModule],
})
export class AppModule {}
