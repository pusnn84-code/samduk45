import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../../app/manifest";
import { COMMUNITY_2027 } from "../../src/content/community-2027";

function pngSize(path: string) {
  const bytes = readFileSync(join(process.cwd(), path));
  expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("PWA manifest", () => {
  it("uses the requested app name and standalone mode", () => {
    const value = manifest();
    expect(value.name).toBe("삼덕사오");
    expect(value.short_name).toBe("삼덕사오");
    expect(value.display).toBe("standalone");
    expect(value.start_url).toBe("/");
    expect(value.description).toContain(String(COMMUNITY_2027.year));
    expect(value.description).toContain(COMMUNITY_2027.motto);
  });

  it("ships correctly sized install icons", () => {
    for (const icon of manifest().icons ?? []) {
      const size = Number(icon.sizes?.split("x")[0]);
      expect(pngSize("public" + icon.src)).toEqual({ width: size, height: size });
    }
    expect(pngSize("public/icons/45-logo-192.png")).toEqual({ width: 192, height: 192 });
    expect(pngSize("public/icons/45-logo-512.png")).toEqual({ width: 512, height: 512 });
    expect(pngSize("public/icons/45-logo-maskable-512.png")).toEqual({ width: 512, height: 512 });
  });
});
