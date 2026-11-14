import { describe, expect, it } from "vitest";
import { INSTALL_URL, installGuide } from "../../components/app/install-guide";

describe("device-specific install guidance", () => {
  it("only shows iPhone installation steps on iPhone", () => {
    const guide = installGuide("Mozilla/5.0 (iPhone) AppleWebKit Safari/604.1");
    expect(guide.kind).toBe("ios");
    expect(guide.steps.join(" ")).toContain("Safari");
    expect(guide.steps.join(" ")).not.toContain("Chrome");
    expect(guide.inApp).toBe(false);
  });
  it("recognizes iPad desktop mode without misidentifying a Mac", () => {
    expect(installGuide("Macintosh", "MacIntel", 5).kind).toBe("ios");
    expect(installGuide("Macintosh", "MacIntel", 0).kind).toBe("desktop");
  });
  it("offers external browser guidance inside KakaoTalk", () => {
    expect(installGuide("Mozilla/5.0 (Linux; Android 15) KAKAOTALK/26")).toMatchObject({ kind: "android", inApp: true });
    expect(installGuide("Mozilla/5.0 (iPhone) KAKAOTALK/26")).toMatchObject({ kind: "ios", inApp: true });
  });
  it("keeps normal Android browser guidance separate from embedded browsers", () => {
    expect(installGuide("Mozilla/5.0 (Linux; Android 15) Chrome/140").inApp).toBe(false);
    expect(installGuide("Mozilla/5.0 (Linux; Android 15; wv) Chrome/140").inApp).toBe(true);
  });
  it("copies only the canonical public URL without account or session information", () => {
    expect(INSTALL_URL).toBe("https://samduk45.vercel.app/");
  });
});
