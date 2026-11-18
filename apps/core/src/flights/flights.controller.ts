import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { FlightsService, type FlightView } from "./flights.service.ts";
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
  async findByKey(
    @Param("key", ParseFlightKeyPipe) parsed: ParsedFlightKey,
  ): Promise<FlightView> {
    const flight = await this.flightService.findByKey(parsed);

    if (flight === null)
      throw new NotFoundException(`Flight ${parsed.key} not found`);

    return flight;
  }
}
