import {
  parseFlightKey,
  type ParseFlightKeyResult,
} from "@interline/contracts";
import { Injectable, type PipeTransform } from "@nestjs/common";
import { InvalidFlightKeyError } from "./invalid-flight-key.error.ts";

export type ParsedFlightKey = Omit<
  Extract<ParseFlightKeyResult, { ok: true }>,
  "ok"
>;

@Injectable()
export class ParseFlightKeyPipe implements PipeTransform<
  string,
  ParsedFlightKey
> {
  transform(value: string): ParsedFlightKey {
    const res = parseFlightKey(value);

    if (!res.ok) throw new InvalidFlightKeyError(res.error, value);

    return {
      key: res.key,
      airline: res.airline,
      number: res.number,
      date: res.date,
    };
  }
}
