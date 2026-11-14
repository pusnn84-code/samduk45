import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin visit management UI", () => {
  it("exposes confirm, complete, and cancel workflow actions", () => {
    const source = readFileSync(
      "components/admin/visits/AdminVisitDetail.tsx",
      "utf8",
    );
    expect(source).toContain("신청 수락 · 캘린더 반영");
    expect(source).toContain("완료");
    expect(source).toContain("취소");
    expect(source).not.toContain("Google");
  });
});
