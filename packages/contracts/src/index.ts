declare const flightKeyBrand: unique symbol;
export type FlightKey = string & { readonly [flightKeyBrand]: "FlightKey" };

interface FormatFlightKeyParams {
  airline: string;
  number: number;
  date: string;
}

export type ParseFlightKeyResult =
  | {
      ok: true;
      key: FlightKey;
      airline: string;
      number: number;
      date: string;
    }
  | { ok: false; error: "format" | "airline" | "number" | "date" };

const airlineExp = /^[A-Z0-9]{2}$/;
const numberExp = /^[1-9]\d{0,3}$/;

export function formatFlightKey(params: FormatFlightKeyParams): FlightKey {
  validateFlightKey(params);
  const { airline, number, date } = params;

  return `${airline}-${number}-${date}` as FlightKey;
}

function validateFlightKey({ airline, number, date }: FormatFlightKeyParams) {
  if (!isValidAirline(airline)) {
    throw new RangeError(
      "Airline should be two uppercase symbols string with letter and number",
    );
  }

  if (!Number.isInteger(number) || number <= 0 || number > 9999) {
    throw new RangeError("Number should be more than 0 and less than 9999");
  }

  const isValid = isValidDate(date);
  if (!isValid) {
    throw new RangeError("Date should be correct and in UTC format");
  }
}

function isValidAirline(code: string): boolean {
  return airlineExp.test(code);
}

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const mod = new Date(`${date}T00:00:00.000Z`);
  return (
    !Number.isNaN(mod.getTime()) && mod.toISOString().slice(0, 10) === date
  );
}

export function parseFlightKey(input: string): ParseFlightKeyResult {
  const parts = input.split("-");

  if (parts.length !== 5) {
    return {
      ok: false,
      error: "format",
    };
  }

  const [airline, number, year, month, day] = parts;

  if (!isValidAirline(airline)) {
    return {
      ok: false,
      error: "airline",
    };
  }

  if (!numberExp.test(number)) {
    return {
      ok: false,
      error: "number",
    };
  }

  const date = `${year}-${month}-${day}`;
  const isValid = isValidDate(date);
  if (!isValid) {
    return {
      ok: false,
      error: "date",
    };
  }

  return {
    ok: true,
    key: input as FlightKey,
    airline,
    number: Number(number),
    date,
  };
}
