import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.ts";
import { AppConfigService } from "./config/app-config.service.ts";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const config = app.get(AppConfigService);

  await app.listen(config.port);
}
await bootstrap();
