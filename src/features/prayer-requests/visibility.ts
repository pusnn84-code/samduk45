import { z } from "zod";
export const PrayerVisibility = z.enum(["private", "public", "anonymous"]);
export type PrayerVisibility = z.infer<typeof PrayerVisibility>;
export const prayerVisibilityLabels = { private: "비공개", public: "공개", anonymous: "무명" } as const;
