import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { InvalidFlightKeyError } from "./flights/invalid-flight-key.error.ts";
import { STATUS_CODES } from "node:http";

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Request>();
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof InvalidFlightKeyError) {
      res.status(400).type("application/problem+json").json({
        type: "/problems/invalid-flight-key",
        title: "Invalid flight key",
        status: 400,
        detail: exception.message,
        instance: req.originalUrl,
        error: exception.kind,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status < 500) {
        res
          .status(status)
          .type("application/problem+json")
          .json({
            type: "about:blank",
            title: STATUS_CODES[status] ?? "Error",
            status,
            detail: exception.message,
            instance: req.originalUrl,
          });
        return;
      }
    }

    const err =
      exception instanceof Error ? exception : new Error(String(exception));

    this.logger.error(err.message, err.stack);
    res.status(500).type("application/problem+json").json({
      type: "about:blank",
      title: "Internal Server Error",
      status: 500,
      instance: req.originalUrl,
    });
  }
}
