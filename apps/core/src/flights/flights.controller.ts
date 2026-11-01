import { Controller, Get, Param } from "@nestjs/common";
import { FlightsService } from "./flights.service.ts";
import {
  ParseFlightKeyPipe,
  type ParsedFlightKey,
} from "./parse-flight-key.pipe.ts";

@Controller("flights")
export class FlightsController {
  private readonly flightService: FlightsService;

  constructor(flightService: FlightsService) {
    this.flightService = flightService;
  }

  @Get("/:key")
  findByKey(@Param("key", ParseFlightKeyPipe) parsed: ParsedFlightKey) {
    return this.flightService.findByKey(parsed);
  }
}
