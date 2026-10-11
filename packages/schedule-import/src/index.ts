import { formatFlightKey } from "@interline/contracts";

interface ExpectedFlightKeyParams {
  airline_code: string;
  flight_number: string;
  dep_time_utc: string;
}

export function expectedFlightKey({
  airline_code,
  dep_time_utc,
  flight_number,
}: ExpectedFlightKeyParams) {
  return formatFlightKey({
    airline: airline_code,
    number: "not-a-number",
    date: dep_time_utc.slice(0, 10),
  });
}
