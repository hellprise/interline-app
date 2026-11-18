import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { AppConfigService } from "../config/app-config.service.ts";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfigService) {
    // Prisma 7 talks to PostgreSQL via a driver adapter.
    // PrismaPg opens pool connections lazily on the first query and $connect() doesn't hit the DB, so calling $connect() makes no sense.
    // If we need to verify DB connectivity on startup, we can run a SELECT 1 query instead.
    super({
      adapter: new PrismaPg({ connectionString: config.databaseUrl }),
    });
  }

  // Close the pool when the service stops.
  // Otherwise, connections will remain active for about 10 seconds of idle time.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
