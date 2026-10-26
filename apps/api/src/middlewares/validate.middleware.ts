import type { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import type { ParamsDictionary } from "express-serve-static-core";
import { BadRequestError } from "@syncstream/shared-utils";

type ValidationTarget = "body" | "params" | "query";

export const validate =
  <T>(schema: ZodType<T>, target: ValidationTarget = "body") =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const message = result.error.issues
        .map(({ path, message }) => `${path.join(".")}:${message}`)
        .join(",");
      return next(new BadRequestError(message));
    }
    switch (target) {
      case "body":
        req.body = result.data;
        break;

      case "params":
        req.params = result.data as ParamsDictionary;
        break;

      case "query":
        res.locals.validatedQuery = result.data;
        break;
    }

    next();
  };
