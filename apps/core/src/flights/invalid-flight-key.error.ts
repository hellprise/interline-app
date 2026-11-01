import type { ParseFlightKeyResult } from "@interline/contracts";

type FlightKeyErrorKind = Extract<ParseFlightKeyResult, { ok: false }>["error"];

export class InvalidFlightKeyError extends Error {
  readonly kind: FlightKeyErrorKind;
  readonly input: string;

  constructor(kind: FlightKeyErrorKind, input: string) {
    super(`Invalid ${kind} in flight key: ${input}`);
    this.name = "InvalidFlightKeyError";
    this.kind = kind;
    this.input = input;
  }
}
