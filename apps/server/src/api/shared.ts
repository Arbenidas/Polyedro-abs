import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 500,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const requireOne = <T>(value: T | undefined, message: string): T => {
  if (!value) {
    throw new ApiError(404, message);
  }

  return value;
};

export const parseUuidParam = (value: string, name: string) => {
  const parsed = z.uuid().safeParse(value);

  if (!parsed.success) {
    throw new ApiError(400, `Invalid ${name}`, parsed.error.flatten());
  }

  return parsed.data;
};

export const parseBody = async <T>(request: Request, schema: z.ZodType<T>) => {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid request body", parsed.error.flatten());
  }

  return parsed.data;
};
