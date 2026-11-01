import { Injectable } from "@nestjs/common";
import type { ParsedFlightKey } from "./parse-flight-key.pipe.ts";

@Injectable()
export class FlightsService {
  findByKey(parsed: ParsedFlightKey) {
    return {
      key: parsed.key,
      airline: parsed.airline,
      number: parsed.number,
      date: parsed.date,
    };
  }
}
