import "server-only";
import { NextResponse } from "next/server";
import { ConfigError } from "./storage";
import { NotFoundError } from "./projects";

/** Wraps a route handler so every failure comes back as { error } with a sensible status. */
export async function respond<T>(fn: () => Promise<T>) {
  try {
    const result = await fn();
    return NextResponse.json(result ?? { ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = e instanceof ConfigError ? 503 : e instanceof NotFoundError ? 404 : 400;
    if (status !== 404) console.error(e);
    return NextResponse.json({ error: message }, { status });
  }
}
