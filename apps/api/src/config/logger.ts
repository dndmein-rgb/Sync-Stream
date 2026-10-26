import pino from "pino";
import { config } from "./index.js";

const baseLogger = pino({
  level: config.NODE_ENV === "development" ? "debug" : config.LOG_LEVEL,
  ...(config.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
  base: {
    service: config.SERVICE_NAME,
  },
});

type LogMeta = Record<string, unknown> | Error | unknown;

type LogFn = {
  (msg: string, meta?: LogMeta): void;
  (meta: LogMeta, msg?: string): void;
};

const toMergingObject = (meta?: LogMeta): Record<string, unknown> => {
  if (meta === undefined || meta === null) return {};
  if (meta instanceof Error) {
    return {
      err: {
        message: meta.message,
        name: meta.name,
        stack: meta.stack,
      },
    };
  }
  if (typeof meta === "object") return meta as Record<string, unknown>;
  return { value: meta };
};

const createLogFn = (level: "info" | "error" | "warn" | "debug"): LogFn => {
  return (msgOrMeta: string | LogMeta, maybeMetaOrMsg?: string | LogMeta) => {
    if (typeof msgOrMeta === "string") {
      baseLogger[level](toMergingObject(maybeMetaOrMsg), msgOrMeta);
      return;
    }
    const obj = toMergingObject(msgOrMeta);
    const msg = typeof maybeMetaOrMsg === "string" ? maybeMetaOrMsg : undefined;
    if (msg) baseLogger[level](obj, msg);
    else baseLogger[level](obj);
  };
};

export const logger = {
  info: createLogFn("info"),
  error: createLogFn("error"),
  warn: createLogFn("warn"),
  debug: createLogFn("debug"),
  child: baseLogger.child.bind(baseLogger),
};