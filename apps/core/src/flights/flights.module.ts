import { Module } from "@nestjs/common";
import { FlightsController } from "./flights.controller.ts";
import { FlightsService } from "./flights.service.ts";

@Module({
  controllers: [FlightsController],
  providers: [FlightsService],
})
export class FlightsModule {}
