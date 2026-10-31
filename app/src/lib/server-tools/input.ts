import "server-only";
import { z } from "zod";
import { ToolInputError } from "./net";

/** Validates a handler's input with a zod schema; the first problem is shown to the visitor. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ToolInputError(parsed.error.issues[0]?.message ?? "Invalid input.");
  return parsed.data;
}

/** A required text field with a length cap. */
export function textField(message: string, max = 2048) {
  return z.string({ error: message }).trim().min(1, { error: message }).max(max, { error: "That value is too long." });
}

/** Rejects with a visitor-facing message when the promise takes longer than `ms`. */
export async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ToolInputError(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}
