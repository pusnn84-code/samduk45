import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { findHymn } from "../../../../../src/content/scripture-library";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  if (!(await getCurrentSessionUser())) return new Response(null, { status: 401, headers });
  const { file } = await params;
  const match = /^([1-9][0-9]{0,2})-[1-9][0-9]?$/.exec(file);
  if (!match || !findHymn(Number(match[1]))?.files.includes(file)) return new Response(null, { status: 404, headers });
  try {
    const bytes = await readFile(path.join(process.cwd(), "data", "scripture-library", "hymns", `${file}.webp`));
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return new Response(null, { status: 404, headers });
  }
}
