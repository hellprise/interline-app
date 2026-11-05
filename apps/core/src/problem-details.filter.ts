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

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    this.logger.error(exception);

    res
      .status(status)
      .type("application/problem+json")
      .json({
        type: "about:blank",
        title: STATUS_CODES[status] ?? "Internal Server Error",
        status: status,
        instance: req.originalUrl,
      });
  }
}
