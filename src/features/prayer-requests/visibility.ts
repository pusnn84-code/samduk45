import { z } from "zod";
export const PrayerVisibility = z.enum(["private", "public", "anonymous", "private_anonymous"]);
export type PrayerVisibility = z.infer<typeof PrayerVisibility>;
export const prayerVisibilityLabels = { private: "비공개", public: "공개", anonymous: "공개 · 무명", private_anonymous: "비공개 · 무명" } as const;
export function prayerDisclosure(scope: "private" | "public", anonymous: boolean): PrayerVisibility {
  return anonymous ? scope === "private" ? "private_anonymous" : "anonymous" : scope;
}
