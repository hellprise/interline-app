import { Injectable } from "@nestjs/common";
import { parseFlightKey } from "@interline/contracts";

@Injectable()
export class FlightsService {
  findByKey(key: string) {
    return parseFlightKey(key);
  }
}
