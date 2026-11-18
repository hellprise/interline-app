import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "./env.schema.ts";

@Injectable()
export class AppConfigService {
  private readonly config: ConfigService<Env, true>;

  constructor(config: ConfigService<Env, true>) {
    this.config = config;
  }

  get port(): number {
    return this.config.getOrThrow("PORT", { infer: true });
  }

  get databaseUrl(): string {
    return this.config.getOrThrow("DATABASE_URL", { infer: true });
  }
}
