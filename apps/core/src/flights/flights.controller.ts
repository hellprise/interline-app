import { BadRequestException, Controller, Get, Param } from "@nestjs/common";
import { FlightsService } from "./flights.service.ts";

@Controller("flights")
export class FlightsController {
  private readonly flightService: FlightsService;

  constructor(flightService: FlightsService) {
    this.flightService = flightService;
  }

  @Get("/:key")
  findByKey(@Param() params: { key: string }) {
    const res = this.flightService.findByKey(params.key);

    if (!res.ok) throw new BadRequestException({ error: res.error });

    return {
      key: res.key,
      airline: res.airline,
      number: res.number,
      date: res.date,
    };
  }
}
