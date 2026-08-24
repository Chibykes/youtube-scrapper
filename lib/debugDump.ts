import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEBUG_DIR = path.join(process.cwd(), ".debug");

/**
 * Dev-only helper for dumping arbitrary data to a JSON file for inspection
 * (e.g. a raw third-party API response). No-ops in production — Vercel's
 * filesystem is read-only there anyway, and this should never affect
 * request handling, so failures are logged, not thrown.
 */
export async function debugDump(name: string, data: unknown): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  try {
    await mkdir(DEBUG_DIR, { recursive: true });
    await writeFile(path.join(DEBUG_DIR, `${name}.json`), JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`debugDump("${name}") failed`, err);
  }
}
