interface FormatFlightKeyParams {
  airline: string;
  number: number;
  date: string;
}

export function formatFlightKey({ airline, number, date }: FormatFlightKeyParams): string {
  return `${airline}-${number}-${date}`;
}
