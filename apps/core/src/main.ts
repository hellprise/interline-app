import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.ts";
import { ConfigService } from "@nestjs/config";
import type { Env } from "./config/env.schema.ts";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);

  await app.listen(config.get("PORT", { infer: true }));
}
await bootstrap();
