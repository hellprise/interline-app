import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.ts";
import type { ParsedFlightKey } from "./parse-flight-key.pipe.ts";

interface AirlineView {
  code: string;
  name: string;
}

interface AirportView {
  iata: string;
  name: string;
  country: string;
}

export interface FlightView {
  key: string;
  number: number;
  departure: Date;
  arrival: Date;
  airline: AirlineView;
  from: AirportView;
  to: AirportView;
}

const airportFields = { iata: true, name: true, country: true } as const;

@Injectable()
export class FlightsService {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  async findByKey(parsed: ParsedFlightKey): Promise<FlightView | null> {
    const flight = await this.prisma.flight.findUnique({
      where: {
        key: parsed.key,
      },
      select: {
        key: true,
        number: true,
        arrTimeUtc: true,
        depTimeUtc: true,
        airline: {
          select: {
            code: true,
            name: true,
          },
        },
        origin: { select: airportFields },
        destination: { select: airportFields },
      },
    });

    if (flight === null) return null;

    return {
      key: flight.key,
      number: flight.number,
      departure: flight.depTimeUtc,
      arrival: flight.arrTimeUtc,
      airline: flight.airline,
      from: flight.origin,
      to: flight.destination,
    };
  }
}
